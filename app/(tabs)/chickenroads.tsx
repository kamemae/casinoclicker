import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- BALANCE SHEETS LOGIC ENGINE ---
const CREDITS_KEY = "@user_total_credits";
const DEFAULT_INITIAL_CREDITS = 10000;

const MoneyManager = {
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

// --- CONFIGURATION MATRIX ---
const STEP_DISTANCE = 55; 
const TOTAL_LOOP_LANES = 12; 

// The static horizontal anchor position of the chicken container
const CHICKEN_LEFT_POSITION = 145; 

type DifficultyMode = "EASY" | "MEDIUM" | "HARD";

interface DifficultyConfig {
  minesPerStep: number;
  multiplierGrowth: number;
}

const DIFFICULTY_MATRIX: Record<DifficultyMode, DifficultyConfig> = {
  EASY: { minesPerStep: 1, multiplierGrowth: 1.15 },
  MEDIUM: { minesPerStep: 2, multiplierGrowth: 1.4 },
  HARD: { minesPerStep: 3, multiplierGrowth: 1.9 },
};

export default function ChickenRoadsCenteredScreen() {
  const isFocused = useIsFocused();

  // Audio Hook Engines
  const jumpPlayer = useAudioPlayer(require("../../assets/audio/base/chicken/jump.mp3"));
  const death1Player = useAudioPlayer(require("../../assets/audio/base/chicken/death1.mp3"));
  const death2Player = useAudioPlayer(require("../../assets/audio/base/chicken/death2.mp3"));
  const placeBetPlayer = useAudioPlayer(require("../../assets/audio/base/placebet.mp3"));

  // State Ecosystem
  const [credits, setCredits] = useState<number>(0);
  const [bet, setBet] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<DifficultyMode>("EASY");
  
  const [totalStepsSurvived, setTotalStepsSurvived] = useState<number>(0); 
  const [gameState, setGameState] = useState<"IDLE" | "PLAYING" | "CRASHED">("IDLE");
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isCashOutLock, setIsCashOutLock] = useState<boolean>(false);
  const [tickerMessage, setTickerMessage] = useState<string>("TAP SCREEN TO START • HOP FORWARD TO RUN");
  const [highestMultiplier, setHighestMultiplier] = useState<number>(0);
  const [activeCarLaneIndex, setActiveCarLaneIndex] = useState<number | null>(null);

  // Layout & FX Animation Chains
  const roadAnimX = useRef(new Animated.Value(0)).current;     
  const chickenAnimY = useRef(new Animated.Value(0)).current;   
  const carAnimY = useRef(new Animated.Value(-60)).current;     
  const shakeAnimX = useRef(new Animated.Value(0)).current;    

  const structuralColumns = Array.from({ length: TOTAL_LOOP_LANES }, (_, i) => i);

  // Global aggregate check for blocking user input hooks
  const isInterfaceLocked = isResetting || isCashOutLock;

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
    if (gameState === "PLAYING" || isInterfaceLocked) return;
    const targetBet = bet + amount;
    if (targetBet > 0 && targetBet <= credits) {
      setBet(targetBet);
    }
  };

  const handleCustomBetInput = (text: string) => {
    if (gameState === "PLAYING" || isInterfaceLocked) return;
    const sanitizedText = text.replace(/[^0-9]/g, "");
    if (sanitizedText === "") {
      setBet(0);
      return;
    }
    const parsedBet = parseInt(sanitizedText, 10);
    setBet(parsedBet <= credits ? parsedBet : credits);
  };

  const getMultiplierForSteps = (steps: number) => {
    if (steps === 0) return 0;
    const config = DIFFICULTY_MATRIX[difficulty];
    return parseFloat(Math.pow(config.multiplierGrowth, steps).toFixed(2));
  };

  const handleStartGame = async () => {
    if (gameState !== "IDLE" || isInterfaceLocked || bet <= 0 || credits < bet) {
      if (credits < bet) setTickerMessage("🚫 INSUFFICIENT CREDITS BALANCE! 🚫");
      return;
    }

    if (placeBetPlayer) {
      placeBetPlayer.seekTo(0);
      placeBetPlayer.play();
    }

    const activeBalance = credits - bet;
    setCredits(activeBalance);
    await MoneyManager.saveCredits(activeBalance);

    setTotalStepsSurvived(0);
    setActiveCarLaneIndex(null);
    setGameState("PLAYING");
    setTickerMessage("🐔 RUN ACTIVE! HOP FORWARD OR CASH OUT!");

    roadAnimX.setValue(0);
    chickenAnimY.setValue(0);
    carAnimY.setValue(-60);
    shakeAnimX.setValue(0);
  };

  const handleStepForward = () => {
    if (gameState !== "PLAYING" || isInterfaceLocked) return;

    const nextTotalSteps = totalStepsSurvived + 1;
    const config = DIFFICULTY_MATRIX[difficulty];

    const crashProbability = config.minesPerStep / 4;
    const isTrapped = Math.random() < crashProbability;

    if (jumpPlayer) {
      jumpPlayer.seekTo(0);
      jumpPlayer.volume = 0.25;
      jumpPlayer.play();
    }

    const targetRoadScroll = -(nextTotalSteps * STEP_DISTANCE);

    Animated.parallel([
      Animated.timing(roadAnimX, {
        toValue: targetRoadScroll,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(chickenAnimY, { toValue: -40, duration: 110, useNativeDriver: true }),
        Animated.timing(chickenAnimY, { toValue: 0, duration: 110, useNativeDriver: true })
      ])
    ]).start(() => {
      if (isTrapped) {
        setGameState("CRASHED");
        setIsResetting(true); // Initiate active interactive lockdown phase
        setTickerMessage(`⚠️ WATCH OUT! TRAFFIC DETECTED AHEAD! ⚠️`);

        setActiveCarLaneIndex(nextTotalSteps); 
        carAnimY.setValue(-60);

        Animated.timing(carAnimY, {
          toValue: 105, 
          duration: 320,
          useNativeDriver: true,
        }).start(() => {
          const randomDeath = Math.random() > 0.5 ? death1Player : death2Player;
          if (randomDeath) {
            randomDeath.seekTo(0);
            randomDeath.play();
          }
          setTickerMessage(`💥 splat! hit by a car at step ${nextTotalSteps}! 💥`);

          Animated.sequence([
            Animated.timing(shakeAnimX, { toValue: -12, duration: 40, useNativeDriver: true }),
            Animated.timing(shakeAnimX, { toValue: 12, duration: 40, useNativeDriver: true }),
            Animated.timing(shakeAnimX, { toValue: -8, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnimX, { toValue: 8, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnimX, { toValue: 0, duration: 50, useNativeDriver: true }),
          ]).start(() => {
            setTimeout(() => {
              resetToIdle();
            }, 2500);
          });
        });

      } else {
        setTotalStepsSurvived(nextTotalSteps);
        const currentMult = getMultiplierForSteps(nextTotalSteps);
        setTickerMessage(`🏃 Step ${nextTotalSteps} Clear! Current Value: ${currentMult}x`);
      }
    });
  };

  const handleCashOut = async () => {
    if (gameState !== "PLAYING" || isInterfaceLocked || totalStepsSurvived === 0) return;

    setIsCashOutLock(true); // Active protective lockdown after cashing out
    const payoutMultiplier = getMultiplierForSteps(totalStepsSurvived);
    const totalPayout = Math.floor(bet * payoutMultiplier);
    const activeVault = await MoneyManager.getCredits();
    const calculationResult = activeVault + totalPayout;

    setTickerMessage(`💰 SAFELY RETREATED! PAYOUT RECEIVED: +$${totalPayout} (${payoutMultiplier}x) 💰`);
    setCredits(calculationResult);
    await MoneyManager.saveCredits(calculationResult);

    if (payoutMultiplier > highestMultiplier) setHighestMultiplier(payoutMultiplier);

    setTimeout(() => {
      resetToIdle();
    }, 2000); // 2 Second Lock for processing and readability
  };

  const resetToIdle = () => {
    setGameState("IDLE");
    setIsResetting(false); 
    setIsCashOutLock(false); // Clear cash out state constraints
    setTotalStepsSurvived(0);
    setActiveCarLaneIndex(null);
    setTickerMessage("TAP SCREEN TO START • HOP FORWARD TO RUN");
    roadAnimX.setValue(0);
    chickenAnimY.setValue(0);
    carAnimY.setValue(-60);
    shakeAnimX.setValue(0);
  };

  return (
    <ImageBackground source={require("../../assets/images/background/background.jpg")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>

        <View style={styles.headerContainer}>
          <Text style={styles.titleText}>CHICKEN ROADS</Text>
          <Text style={styles.subtitleText}>"WYŁĄCZAJ TO"</Text>
        </View>

        <Animated.View style={[styles.machineCabinet, { transform: [{ translateX: shakeAnimX }] }]}>
          
          <View style={styles.ledDisplay}>
            <Text style={styles.ledText}>{tickerMessage}</Text>
          </View>

          <View style={styles.difficultyContainer}>
            {(["EASY", "MEDIUM", "HARD"] as DifficultyMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                disabled={gameState === "PLAYING" || isInterfaceLocked}
                onPress={() => setDifficulty(mode)}
                style={[
                  styles.diffPill,
                  difficulty === mode && styles.diffPillActive,
                  (gameState === "PLAYING" || isInterfaceLocked) && { opacity: 0.4 }
                ]}
              >
                <Text style={styles.diffPillText}>{mode}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stadium Screen Playfield surface wrapper zone */}
          <View style={styles.stadiumWindowCompressed}>
            
            {/* Scrolling Road Grid System Engine */}
            <Animated.View 
              style={[
                styles.horizontalHighwayStrip, 
                { transform: [{ translateX: roadAnimX }] }
              ]}
            >
              <View style={styles.startZoneBlock}>
                <Text style={styles.startZoneText}>START</Text>
              </View>

              {structuralColumns.map((id) => {
                const holdsSpawningCarObstacle = activeCarLaneIndex === id;

                return (
                  <View key={`road-col-${id}`} style={styles.highwayColumn}>
                    <View style={styles.trafficStripingField}>
                      <View style={styles.roadDashMark} />
                      <View style={styles.roadDashMark} />
                      <View style={styles.roadDashMark} />
                      <View style={styles.roadDashMark} />
                    </View>

                    {holdsSpawningCarObstacle && (
                      <Animated.View 
                        style={[
                          styles.carObstacleSprite, 
                          { transform: [{ translateY: carAnimY }] }
                        ]}
                      >
                        <Text style={styles.carIcon}>🚗</Text>
                      </Animated.View>
                    )}
                  </View>
                );
              })}
            </Animated.View>

            {/* Anchored Chicken Token Sprite Frame Layer */}
            <Animated.View 
              style={[
                styles.centeredChickenContainer, 
                { transform: [{ translateY: chickenAnimY }] }
              ]}
            >
              <Text style={styles.chickenIcon}>
                {gameState === "CRASHED" ? "💥" : "🐔"}
              </Text>
              {gameState === "PLAYING" && (
                <View style={styles.stepCountBadge}>
                  <Text style={styles.badgeText}>{totalStepsSurvived}</Text>
                </View>
              )}
            </Animated.View>

            {/* --- CONTEXT SENSITIVE SCREEN INTERACTION LAYER --- */}
            {isResetting ? (
              <View style={styles.highPriorityOverlayContainer}>
                <Text style={[styles.startCalloutText, styles.crashCooldownTextDecoration]}>
                  CLEANING UP...
                </Text>
              </View>
            ) : isCashOutLock ? (
              // High-priority interface layer capturing interactions securely after cashouts
              <View style={[styles.highPriorityOverlayContainer, { backgroundColor: "rgba(0, 0, 0, 0.45)" }]}>
                <Text style={[styles.startCalloutText, styles.cashOutLockTextDecoration]}>
                  💰 CASHING OUT...
                </Text>
              </View>
            ) : gameState === "IDLE" ? (
              <TouchableOpacity 
                activeOpacity={0.8}
                style={styles.fullScreenTriggerOverlay}
                onPress={handleStartGame}
              >
                <Text style={styles.startCalloutText}>TAP TO START RUN</Text>
              </TouchableOpacity>
            ) : gameState === "PLAYING" ? (
              <View style={styles.absoluteHitboxOverlayContainer}>
                {/* Hitbox Left (Behind Chicken) -> Cash out Trigger */}
                <TouchableOpacity 
                  activeOpacity={0.6}
                  style={styles.hitboxBehindTouchArea} 
                  onPress={handleCashOut}
                >
                  <Text style={styles.hitboxHintText}>⬅️ CASH OUT</Text>
                </TouchableOpacity>

                {/* Hitbox Right (In Front of Chicken) -> Hop Forward Trigger */}
                <TouchableOpacity 
                  activeOpacity={0.6}
                  style={styles.hitboxAheadTouchArea} 
                  onPress={handleStepForward}
                >
                  <Text style={styles.hitboxHintText}>HOP FORWARD ➡️</Text>
                </TouchableOpacity>
              </View>
            ) : null}

          </View>

          <View style={styles.dashboardRow}>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>VAULT FUNDS</Text>
              <Text style={[styles.statValue, { color: "#00ffcc" }]}>${credits}</Text>
            </View>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>CURRENT RUN</Text>
              <Text style={[styles.statValue, { color: "#ffcc00" }]}>
                {totalStepsSurvived > 0 ? `${getMultiplierForSteps(totalStepsSurvived)}x` : "0.00x"}
              </Text>
            </View>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>BEST MULTI</Text>
              <Text style={[styles.statValue, { color: "#ff0055" }]}>{highestMultiplier}x</Text>
            </View>
          </View>

        </Animated.View>

        {/* Lower Wager Selection Deck Console Container */}
        <View style={styles.buttonConsoleDeck}>
          {gameState === "PLAYING" || isInterfaceLocked ? (
            <View style={styles.gameActionPanelRow}>
              <TouchableOpacity 
                style={[styles.arcadeButton, styles.cashOutBtn, (totalStepsSurvived === 0 || isInterfaceLocked) && styles.disabledBtn]} 
                disabled={totalStepsSurvived === 0 || isInterfaceLocked}
                onPress={handleCashOut}
              >
                <Text style={styles.btnText}>💰 CASH OUT</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.arcadeButton, styles.hopForwardBtn, isInterfaceLocked && styles.disabledBtn]} 
                disabled={isInterfaceLocked}
                onPress={handleStepForward}
              >
                <Text style={styles.spinBtnText}>🏃 HOP AHEAD</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.arcadeButton, styles.blueBtn]} 
                onPress={() => changeBet(-5)}
              >
                <Text style={styles.btnText}>BET -5</Text>
              </TouchableOpacity>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.customBetInput}
                  editable={!isInterfaceLocked}
                  keyboardType="number-pad"
                  value={bet === 0 ? "" : bet.toString()}
                  onChangeText={handleCustomBetInput}
                  maxLength={6}
                  placeholder="0"
                  placeholderTextColor="#555"
                  selectTextOnFocus
                />
              </View>

              <TouchableOpacity 
                style={[styles.arcadeButton, styles.blueBtn]} 
                onPress={() => changeBet(5)}
              >
                <Text style={styles.btnText}>BET +5</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.arcadeButton, 
                  styles.spinBtn, 
                  (credits < bet || bet === 0 || isInterfaceLocked) && styles.disabledBtn
                ]}
                disabled={credits < bet || bet === 0 || isInterfaceLocked}
                onPress={handleStartGame}
              >
                <Text style={styles.spinBtnText}>START</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

      </View>
    </ImageBackground>
  );
}

// --- CONTEXTUAL STYLE ARCHITECTURE GRAPHICS LAYOUT ---
const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  
  headerContainer: { alignItems: "center", marginBottom: 10 },
  titleText: { fontSize: 36, fontWeight: "900", color: "#ff0055", letterSpacing: 4, textShadowColor: "#ff0055", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  subtitleText: { fontSize: 14, fontWeight: "bold", color: "#00ffff", letterSpacing: 6, textShadowColor: "#00ffff", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },

  machineCabinet: { backgroundColor: "#1e1e24", padding: 14, borderRadius: 24, borderWidth: 5, borderColor: "#4d4d5a", width: 345, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  ledDisplay: { backgroundColor: "#050505", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, borderWidth: 2, borderColor: "#333", marginBottom: 12, alignItems: "center", minHeight: 44, justifyContent: "center" },
  ledText: { color: "#ff3333", fontWeight: "bold", fontSize: 11, letterSpacing: 0.5, textAlign: "center", lineHeight: 14 },

  difficultyContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  diffPill: { flex: 1, backgroundColor: "#2f3640", paddingVertical: 6, marginHorizontal: 2, borderRadius: 6, alignItems: "center", borderWidth: 1, borderColor: "#444" },
  diffPillActive: { backgroundColor: "#ffcc00", borderColor: "#fff" },
  diffPillText: { color: "#fff", fontSize: 9, fontWeight: "900" },

  stadiumWindowCompressed: { 
    backgroundColor: "#222", 
    borderRadius: 14, 
    borderWidth: 3, 
    borderColor: "#555", 
    overflow: "hidden", 
    height: 280, 
    justifyContent: "center",
    position: "relative"
  },
  horizontalHighwayStrip: { 
    flexDirection: "row", 
    alignItems: "stretch", 
    height: "100%",
    left: 120 
  },
  startZoneBlock: { width: 50, backgroundColor: "#27ae60", justifyContent: "center", alignItems: "center", borderRightWidth: 2, borderRightColor: "#219653" },
  startZoneText: { color: "#fff", fontSize: 11, fontWeight: "900", transform: [{ rotate: "-90deg" }], letterSpacing: 2 },
  
  highwayColumn: { width: STEP_DISTANCE, borderRightWidth: 1, borderRightColor: "#3d3d3d", backgroundColor: "#2c3e50", alignItems: "center", justifyContent: "center", position: "relative" },
  trafficStripingField: { height: "100%", justifyContent: "space-around", alignItems: "center", width: "100%" },
  roadDashMark: { width: 3, height: 20, backgroundColor: "#fff", opacity: 0.25, borderRadius: 2 },

  carObstacleSprite: { position: "absolute", left: 10, top: 0, zIndex: 50, width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  carIcon: { fontSize: 26 },

  centeredChickenContainer: { 
    position: "absolute", 
    left: CHICKEN_LEFT_POSITION, 
    top: "42%", 
    width: 40, 
    height: 40, 
    justifyContent: "center", 
    alignItems: "center", 
    zIndex: 99 
  },
  chickenIcon: { fontSize: 32, textShadowColor: "#000", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 3 },
  stepCountBadge: { position: "absolute", bottom: -8, backgroundColor: "#e74c3c", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: "#fff" },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  // --- SCREEN HITBOX OVERLAYS AND ENGINE ---
  fullScreenTriggerOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 105
  },
  highPriorityOverlayContainer: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)", 
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200 
  },
  startCalloutText: {
    color: "rgba(255, 204, 0, 0.7)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 204, 0, 0.3)",
    overflow: "hidden"
  },
  crashCooldownTextDecoration: {
    color: "#ff3333",
    borderColor: "rgba(255,51,51,0.5)",
    textShadowColor: "rgba(255,51,51,0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6
  },
  cashOutLockTextDecoration: {
    color: "#2ecc71",
    borderColor: "rgba(46,204,113,0.5)",
    textShadowColor: "rgba(46,204,113,0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6
  },
  absoluteHitboxOverlayContainer: { 
    position: "absolute", 
    inset: 0, 
    flexDirection: "row", 
    zIndex: 100 
  },
  hitboxBehindTouchArea: { 
    width: CHICKEN_LEFT_POSITION, 
    height: "100%", 
    justifyContent: "flex-end", 
    padding: 10,
    backgroundColor: "transparent"
  },
  hitboxAheadTouchArea: { 
    flex: 1, 
    height: "100%", 
    justifyContent: "flex-end", 
    alignItems: "flex-end",
    padding: 10,
    backgroundColor: "transparent"
  },
  hitboxHintText: { color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "900", backgroundColor: "rgba(0,0,0,0.5)", padding: 4, borderRadius: 4, overflow: "hidden" },

  dashboardRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, backgroundColor: "#111", padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "#444" },
  dashboardStat: { alignItems: "center", flex: 1, justifyContent: "center" },
  statLabel: { fontSize: 8, fontWeight: "bold", color: "#888", marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: "900", textAlign: "center" },

  buttonConsoleDeck: { flexDirection: "row", backgroundColor: "#2f3640", padding: 12, borderRadius: 16, marginTop: 15, borderWidth: 3, borderColor: "#718093", width: 345, justifyContent: "space-between", alignItems: "center" },
  gameActionPanelRow: { flex: 1, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  
  arcadeButton: { paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10, justifyContent: "center", alignItems: "center", minWidth: 65, borderBottomWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3 },
  blueBtn: { backgroundColor: "#00a8ff", borderBottomColor: "#0088cc" },
  spinBtn: { backgroundColor: "#4cd137", borderBottomColor: "#44bd32", minWidth: 80 },
  cashOutBtn: { backgroundColor: "#e74c3c", borderBottomColor: "#c0392b", flex: 1 },
  hopForwardBtn: { backgroundColor: "#4cd137", borderBottomColor: "#44bd32", flex: 1.3 },
  disabledBtn: { backgroundColor: "#718093", borderBottomColor: "#2f3640", opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  spinBtnText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.5, textAlign: "center" },

  inputWrapper: { width: 70, height: 42, backgroundColor: "#000", borderRadius: 8, borderWidth: 2, borderColor: "#ffcc00", justifyContent: "center", alignItems: "center" },
  customBetInput: { width: "100%", height: "100%", color: "#ffcc00", fontSize: 16, fontWeight: "900", textAlign: "center", padding: 0 },
});