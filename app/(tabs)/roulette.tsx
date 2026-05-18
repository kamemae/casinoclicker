import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

// --- MONEY MANAGER STORAGE ENGINE (Shared Architecture) ---
const CREDITS_KEY = "@user_total_credits";
const DEFAULT_INITIAL_CREDITS = 10000;

export const MoneyManager = {
  getCredits: async (): Promise<number> => {
    try {
      const stored = await AsyncStorage.getItem(CREDITS_KEY);
      if (stored !== null) return parseInt(stored, 10);
      await AsyncStorage.setItem(CREDITS_KEY, DEFAULT_INITIAL_CREDITS.toString());
      return DEFAULT_INITIAL_CREDITS;
    } catch (error) {
      console.error("Failed to fetch credits:", error);
      return DEFAULT_INITIAL_CREDITS;
    }
  },
  saveCredits: async (amount: number): Promise<void> => {
    try {
      await AsyncStorage.setItem(CREDITS_KEY, amount.toString());
    } catch (error) {
      console.error("Failed to save credits:", error);
    }
  }
};

// --- ROULETTE WHEEL DATA MAP (Standard European Layout) ---
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const getNumberColor = (num: number): "green" | "red" | "black" => {
  if (num === 0) return "green";
  return RED_NUMBERS.includes(num) ? "red" : "black";
};

type BetType = "red" | "black" | "even" | "odd";

export default function RouletteScreen() {
  const isFocused = useIsFocused();
  const wheelRotation = useRef(new Animated.Value(0)).current;

  // Sound Engine Instance Assets (Win Condition Only)
  const winAudioSource = require("../../assets/audio/base/cards/shuffle.mp3");
  const winPlayer = useAudioPlayer(winAudioSource);

  // App Ecosystem States
  const [credits, setCredits] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [selectedBetType, setSelectedBetType] = useState<BetType | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("SELECT AN OUTCOME AND SPIN THE WHEEL");
  const [lastWinningNumber, setLastWinningNumber] = useState<number | null>(null);

  const currentBetRef = useRef(betAmount);
  useEffect(() => {
    currentBetRef.current = betAmount;
  }, [betAmount]);

  // Load Balance
  useEffect(() => {
    if (isFocused) {
      const loadInitialBalance = async () => {
        const currentBalance = await MoneyManager.getCredits();
        setCredits(currentBalance);
      };
      loadInitialBalance();
    }
  }, [isFocused]);

  const changeBet = (amount: number) => {
    if (isSpinning) return;
    const targetBet = betAmount + amount;
    if (targetBet > 0 && targetBet <= credits) {
      setBetAmount(targetBet);
    }
  };

  const handleCustomBetInput = (text: string) => {
    if (isSpinning) return;
    const sanitizedText = text.replace(/[^0-9]/g, "");
    if (sanitizedText === "") {
      setBetAmount(0);
      return;
    }
    const parsedBet = parseInt(sanitizedText, 10);
    if (parsedBet <= credits) {
      setBetAmount(parsedBet);
    } else {
      setBetAmount(credits);
    }
  };

  const updateCreditsAndPersist = async (newCreditsValue: number) => {
    setCredits(newCreditsValue);
    await MoneyManager.saveCredits(newCreditsValue);
  };

  // --- SPIN MECHANICS AND ANIMATION ENGINE ---
  const handleSpinWheel = async () => {
    if (isSpinning) return;
    if (!selectedBetType) {
      setMessage("🚫 CHOOSE A WAGER MATRIX COMBINATION! 🚫");
      return;
    }

    const activeWager = currentBetRef.current;
    const freshCredits = await MoneyManager.getCredits();

    if (activeWager <= 0) {
      setMessage("🚫 CHOOSE A VALID WAGER! 🚫");
      return;
    }
    if (freshCredits < activeWager) {
      setMessage("🚫 INSUFFICIENT CREDITS! 🚫");
      return;
    }

    setIsSpinning(true);
    setMessage("🔮 THE BALL IS IN MOTION... 🔮");
    const balanceAfterBet = freshCredits - activeWager;
    await updateCreditsAndPersist(balanceAfterBet);

    const totalSlots = WHEEL_NUMBERS.length;
    const randomSlotIndex = Math.floor(Math.random() * totalSlots);
    const winningNumber = WHEEL_NUMBERS[randomSlotIndex];

    const degreesPerSlot = 360 / totalSlots;
    const baseTargetDegrees = 360 - (randomSlotIndex * degreesPerSlot);
    
    // 2 full structural visual rotations + the final offset target
    const targetVisualSpinRevolutions = 2;
    const finalTargetRotation = baseTargetDegrees + (360 * targetVisualSpinRevolutions);

    wheelRotation.setValue(0);

    const TOTAL_ANIMATION_DURATION = 8200; // 8.2 seconds for a natural casino feel

    Animated.timing(wheelRotation, {
      toValue: finalTargetRotation,
      duration: TOTAL_ANIMATION_DURATION,
      easing: Easing.bezier(0.1, 0.6, 0.15, 1),
      useNativeDriver: true,
    }).start(async () => {
      setLastWinningNumber(winningNumber);
      await evaluatePayoutOutcome(winningNumber, activeWager, balanceAfterBet);
      setIsSpinning(false);
    });
  };

  const evaluatePayoutOutcome = async (winningNum: number, wager: number, baseBalance: number) => {
    const numColor = getNumberColor(winningNum);
    const isEven = winningNum !== 0 && winningNum % 2 === 0;
    const isOdd = winningNum !== 0 && winningNum % 2 !== 0;

    let playerWon = false;

    if (selectedBetType === "red" && numColor === "red") playerWon = true;
    if (selectedBetType === "black" && numColor === "black") playerWon = true;
    if (selectedBetType === "even" && isEven) playerWon = true;
    if (selectedBetType === "odd" && isOdd) playerWon = true;

    const formattedColorText = numColor.toUpperCase();

    if (playerWon) {
      const payoutValue = wager * 2; 
      const cleanFinalTotal = baseBalance + payoutValue;
      await updateCreditsAndPersist(cleanFinalTotal);
      if (winPlayer) winPlayer.play();
      setMessage(`🏆 HIT ${winningNum} (${formattedColorText})! YOU WON: $${payoutValue} 🏆`);
    } else {
      setMessage(`💥 HIT ${winningNum} (${formattedColorText})! TRY AGAIN! 💥`);
    }
  };

  const interpolatedWheelRotation = wheelRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <ImageBackground source={require("../../assets/images/background/background.jpg")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>

        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={styles.titleText}>BALLS-WHEEL</Text>
          <Text style={styles.subtitleText}>Roulette</Text>
        </View>

        {/* Central Machine Cabinet Layout */}
        <View style={styles.machineCabinet}>

          {/* LED Status Bar */}
          <View style={styles.ledDisplay}>
            <Text style={styles.ledText}>{message}</Text>
          </View>

          {/* Main Visual Display Window Area */}
          <View style={styles.glassWindow}>
            
            {/* Structural Kinetic Wheel Frame Assembly */}
            <View style={styles.wheelOuterBoundary}>
              <Animated.View style={[styles.wheelCoreRotator, { transform: [{ rotate: interpolatedWheelRotation }] }]}>
                {/* Center Core Cap Piece */}
                <View style={styles.wheelCenterHub}>
                  {lastWinningNumber !== null && (
                    <Text style={[styles.hubNumberDisplay, { color: getNumberColor(lastWinningNumber) === "red" ? "#ff4757" : getNumberColor(lastWinningNumber) === "black" ? "#ffffff" : "#2ed573" }]}>
                      {lastWinningNumber}
                    </Text>
                  )}
                </View>
                
                {/* Visual Target Decal Nodes */}
                {WHEEL_NUMBERS.map((num, i) => {
                  const sliceAngle = 360 / WHEEL_NUMBERS.length;
                  const targetRotation = i * sliceAngle;
                  const itemColor = getNumberColor(num);
                  return (
                    <View
                      key={`slot-${num}-${i}`}
                      style={[
                        styles.wheelAbsoluteRaySlot,
                        { transform: [{ rotate: `${targetRotation}deg` }] }
                      ]}
                    >
                      <View style={[styles.miniPocketIndicatorBall, itemColor === "red" && styles.bgRed, itemColor === "black" && styles.bgBlack, itemColor === "green" && styles.bgGreen]}>
                        <Text style={styles.rayItemTextNumber}>{num}</Text>
                      </View>
                    </View>
                  );
                })}
              </Animated.View>

              {/* Pinpoint Pointer Guide Assembly */}
              <View style={styles.topPinpointTargetNeedle} />
            </View>

            {/* Betting Board Matrix Panel Layout Selection System */}
            <View style={styles.betSelectionMatrixDashboard}>
              <TouchableOpacity
                disabled={isSpinning}
                style={[styles.matrixChipButton, styles.bgRed, selectedBetType === "red" && styles.activeSelectedChipBorder]}
                onPress={() => setSelectedBetType("red")}
              >
                <Text style={styles.matrixChipText}>RED</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={isSpinning}
                style={[styles.matrixChipButton, styles.bgBlack, selectedBetType === "black" && styles.activeSelectedChipBorder]}
                onPress={() => setSelectedBetType("black")}
              >
                <Text style={styles.matrixChipText}>BLACK</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={isSpinning}
                style={[styles.matrixChipButton, styles.bgDarkSlate, selectedBetType === "even" && styles.activeSelectedChipBorder]}
                onPress={() => setSelectedBetType("even")}
              >
                <Text style={styles.matrixChipText}>EVEN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={isSpinning}
                style={[styles.matrixChipButton, styles.bgDarkSlate, selectedBetType === "odd" && styles.activeSelectedChipBorder]}
                onPress={() => setSelectedBetType("odd")}
              >
                <Text style={styles.matrixChipText}>ODD</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Core Stat Dashboard Panel */}
          <View style={styles.dashboardRow}>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>TOTAL CREDITS</Text>
              <Text style={[styles.statValue, { color: "#00ffcc" }]}>${credits}</Text>
            </View>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>STAKE VALUE</Text>
              <Text style={[styles.statValue, { color: "#ffcc00" }]}>{betAmount}</Text>
            </View>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>TARGET CONFIG</Text>
              <Text style={[styles.statValue, { color: "#ff0055", fontSize: 10, marginTop: 4 }]}>
                {selectedBetType ? selectedBetType.toUpperCase() : "NONE"}
              </Text>
            </View>
          </View>
        </View>

        {/* Unified Bottom Console Control Deck */}
        <View style={styles.buttonConsoleDeck}>
          <TouchableOpacity style={[styles.arcadeButton, styles.blueBtn]} onPress={() => changeBet(-5)} disabled={isSpinning}>
            <Text style={styles.btnText}>BET -5</Text>
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.customBetInput}
              keyboardType="number-pad"
              value={betAmount === 0 ? "" : betAmount.toString()}
              onChangeText={handleCustomBetInput}
              maxLength={6}
              placeholder="0"
              placeholderTextColor="#555"
              selectTextOnFocus
              editable={!isSpinning}
            />
          </View>

          <TouchableOpacity style={[styles.arcadeButton, styles.blueBtn]} onPress={() => changeBet(5)} disabled={isSpinning}>
            <Text style={styles.btnText}>BET +5</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.arcadeButton, styles.spinBtn, (credits < betAmount || betAmount === 0 || isSpinning) && styles.disabledBtn]} 
            onPress={handleSpinWheel}
            disabled={credits < betAmount || betAmount === 0 || isSpinning}
          >
            <Text style={styles.spinBtnText}>{isSpinning ? "ROLLING..." : "SPIN"}</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ImageBackground>
  );
}

// --- ARCHITECTURE STYLESHEET LAYOUTS ---
const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  headerContainer: { alignItems: "center", marginBottom: 15 },
  titleText: { fontSize: 36, fontWeight: "900", color: "#ff0055", letterSpacing: 4, textShadowColor: "#ff0055", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  subtitleText: { fontSize: 14, fontWeight: "bold", color: "#00ffff", letterSpacing: 6, textShadowColor: "#00ffff", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },

  machineCabinet: { backgroundColor: "#1e1e24", padding: 14, borderRadius: 23, borderWidth: 6, borderColor: "#4d4d5a", shadowColor: "#000", shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.6, shadowRadius: 15, elevation: 12, width: 330 },
  ledDisplay: { backgroundColor: "#050505", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, borderWidth: 2, borderColor: "#333", marginBottom: 12, alignItems: "center" },
  ledText: { color: "#ff3333", fontWeight: "bold", fontSize: 11, letterSpacing: 0.5, textAlign: "center" },

  glassWindow: { backgroundColor: "#0b0c10", borderRadius: 14, borderWidth: 3, borderColor: "#ffcc00", padding: 10, height: 350, width: "100%", justifyContent: "space-between", alignItems: "center" },
  
  wheelOuterBoundary: { width: 210, height: 210, borderRadius: 105, backgroundColor: "#1c1e22", borderWidth: 6, borderColor: "#718093", justifyContent: "center", alignItems: "center", position: "relative", shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 5, elevation: 5 },
  wheelCoreRotator: { width: "100%", height: "100%", borderRadius: 105, justifyContent: "center", alignItems: "center", position: "relative" },
  wheelCenterHub: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#0b0c10", zIndex: 10, borderWidth: 3, borderColor: "#ffcc00", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowRadius: 3, shadowOpacity: 0.5 },
  hubNumberDisplay: { fontSize: 18, fontWeight: "900" },
  
  wheelAbsoluteRaySlot: { position: "absolute", height: "100%", width: 20, top: 0, left: 89, alignItems: "center", justifyContent: "flex-start" },
  miniPocketIndicatorBall: { width: 14, height: 14, borderRadius: 7, marginTop: 4, justifyContent: "center", alignItems: "center" },
  rayItemTextNumber: { color: "#fff", fontSize: 7, fontWeight: "bold" },
  
  topPinpointTargetNeedle: { position: "absolute", top: -8, width: 0, height: 0, backgroundColor: "transparent", borderStyle: "solid", borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 18, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#ffcc00", zIndex: 20 },

  betSelectionMatrixDashboard: { flexDirection: "row", flexWrap: "wrap", width: "100%", gap: 6, justifyContent: "center", marginTop: 5 },
  matrixChipButton: { width: "46%", paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  activeSelectedChipBorder: { borderColor: "#ffffff85", shadowRadius: 5, shadowOpacity: 0.8 },
  matrixChipText: { color: "#ffffff", fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  bgRed: { backgroundColor: "#e84118" },
  bgBlack: { backgroundColor: "#2f3640" },
  bgGreen: { backgroundColor: "#4cd137" },
  bgDarkSlate: { backgroundColor: "#1f2833", borderWidth: 1, borderColor: "#444" },

  dashboardRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, backgroundColor: "#111", padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "#444" },
  dashboardStat: { alignItems: "center", flex: 1 },
  statLabel: { fontSize: 8, fontWeight: "bold", color: "#888", marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: "900" },

  buttonConsoleDeck: { flexDirection: "row", backgroundColor: "#2f3640", padding: 12, borderRadius: 16, marginTop: 20, borderWidth: 3, borderColor: "#718093", width: 340, justifyContent: "space-between", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 8 },
  arcadeButton: { paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10, justifyContent: "center", alignItems: "center", minWidth: 65, borderBottomWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3 },
  blueBtn: { backgroundColor: "#00a8ff", borderBottomColor: "#0088cc" },
  spinBtn: { backgroundColor: "#4cd137", borderBottomColor: "#44bd32", minWidth: 80 },
  disabledBtn: { backgroundColor: "#718093", borderBottomColor: "#2f3640", opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  spinBtnText: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },

  inputWrapper: { width: 70, height: 42, backgroundColor: "#000", borderRadius: 8, borderWidth: 2, borderColor: "#ffcc00", justifyContent: "center", alignItems: "center" },
  customBetInput: { width: "100%", height: "100%", color: "#ffcc00", fontSize: 16, fontWeight: "900", textAlign: "center", padding: 0 },
});