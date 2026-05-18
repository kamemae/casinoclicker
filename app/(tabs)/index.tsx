import { useIsFocused } from "@react-navigation/native";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Animated, ImageBackground, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MoneyManager } from "../../api/moneyManager";

const FRUITS = ["🍉", "🍋", "🍌", "🍍", "🍒", "🍇", "🥝"];
const LEVER_MAX_DRAG = 90;
const audio = require("../../assets/audio/base/spin.mp3");

const generateRandomGrid = () => [
  [FRUITS[Math.floor(Math.random() * FRUITS.length)], FRUITS[Math.floor(Math.random() * FRUITS.length)], FRUITS[Math.floor(Math.random() * FRUITS.length)]],
  [FRUITS[Math.floor(Math.random() * FRUITS.length)], FRUITS[Math.floor(Math.random() * FRUITS.length)], FRUITS[Math.floor(Math.random() * FRUITS.length)]],
  [FRUITS[Math.floor(Math.random() * FRUITS.length)], FRUITS[Math.floor(Math.random() * FRUITS.length)], FRUITS[Math.floor(Math.random() * FRUITS.length)]],
];

export default function SlotMachine() {
  const isFocused = useIsFocused();
  const [grid, setGrid] = useState<string[][]>([
    ["🎰", "🎰", "🎰"],
    ["🎰", "🎰", "🎰"],
    ["🎰", "🎰", "🎰"],
  ]);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState("INSERT COIN OR PULL LEVER");
  const [credits, setCredits] = useState<number>(0);
  const [bet, setBet] = useState(10);
  const [lastWin, setLastWin] = useState(0);
  const [winningCells, setWinningCells] = useState<string[]>([]);
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const leverY = useRef(new Animated.Value(0)).current;
  const audioPlayer = useAudioPlayer(audio);

  // Read current bet securely via a ref to completely stop timeout closures from using stale values
  const currentBetRef = useRef(bet);
  useEffect(() => {
    currentBetRef.current = bet;
  }, [bet]);

  useEffect(() => {
    if (isFocused) {
      const loadInitialBalance = async () => {
        const currentBalance = await MoneyManager.getCredits();
        setCredits(currentBalance);
      };
      loadInitialBalance();
    }
  }, [isFocused]);

  useEffect(() => {
    if (winningCells.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.2, duration: 400, useNativeDriver: false })
        ])
      ).start();
    } else {
      glowAnim.setValue(0.3);
    }
  }, [winningCells]);

  const changeBet = (amount: number) => {
    if (spinning) return;
    const newBet = bet + amount;
    if (newBet <= credits && newBet > 0) {
      setBet(newBet);
    }
  };

  // Handles direct numeric typing inputs smoothly
  const handleCustomBetInput = (text: string) => {
    if (spinning) return;
    
    const sanitizedText = text.replace(/[^0-9]/g, "");
    if (sanitizedText === "") {
      setBet(0);
      return;
    }

    const parsedBet = parseInt(sanitizedText, 10);
    if (parsedBet <= credits) {
      setBet(parsedBet);
    } else {
      setBet(credits); // Max out capacity securely if they try to over-wager
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, 
      onPanResponderMove: (_, gestureState) => {
        if (!spinning && gestureState.dy >= 0 && gestureState.dy <= LEVER_MAX_DRAG && bet > 0) {
          leverY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (spinning || bet === 0) return;
        if (gestureState.dy >= LEVER_MAX_DRAG * 0.7) {
          Animated.sequence([
            Animated.timing(leverY, { toValue: LEVER_MAX_DRAG, duration: 50, useNativeDriver: true }),
            Animated.spring(leverY, { toValue: 0, friction: 4, useNativeDriver: true })
          ]).start();
          triggerSpin();
        } else {
          Animated.spring(leverY, { toValue: 0, friction: 5, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const triggerSpin = async () => {
    if (spinning) return;

    const freshCredits = await MoneyManager.getCredits();
    const activeBet = currentBetRef.current;

    if (activeBet <= 0) {
      setMessage("🚫 CHOOSE A VALID WAGER! 🚫");
      return;
    }

    if (freshCredits < activeBet) {
      setMessage("🚫 INSUFFICIENT CREDITS! 🚫");
      setCredits(freshCredits);
      return;
    }

    if (audioPlayer) {
      audioPlayer.seekTo(0);
      audioPlayer.play();
    }

    setSpinning(true);
    setWinningCells([]); 
    setLastWin(0);
    setMessage("⚡ WHEELS SPINNING... ⚡");

    const balanceAfterBet = freshCredits - activeBet;
    setCredits(balanceAfterBet);
    await MoneyManager.saveCredits(balanceAfterBet);

    const SPIN_DURATION = 9000; // Restored back to match the original audio track layout
    const startTime = Date.now();

    const runShuffleCycle = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= SPIN_DURATION) {
        const finalGrid = generateRandomGrid();
        setGrid(finalGrid);
        setMessage("🛑 CALCULATING... 🛑");
        setTimeout(() => {
          setSpinning(false);
          calculateWin(finalGrid, balanceAfterBet, activeBet);
        }, 1500);
        return;
      }
      const progress = elapsed / SPIN_DURATION;
      const currentDelay = 30 + Math.pow(progress, 3) * 420;
      setGrid(generateRandomGrid());
      setTimeout(runShuffleCycle, currentDelay);
    };

    runShuffleCycle();
  };

  const calculateWin = async (g: string[][], balanceContext: number, appliedBet: number) => {
    let linesWon = 0;
    const matchedCoordinates: string[] = [];

    for (let r = 0; r < 3; r++) {
      if (g[r][0] === g[r][1] && g[r][1] === g[r][2]) {
        linesWon++;
        matchedCoordinates.push(`${r}-0`, `${r}-1`, `${r}-2`);
      }
    }
    for (let c = 0; c < 3; c++) {
      if (g[0][c] === g[1][c] && g[1][c] === g[2][c]) {
        linesWon++;
        matchedCoordinates.push(`0-${c}`, `1-${c}`, `2-${c}`);
      }
    }
    if (g[0][0] === g[1][1] && g[1][1] === g[2][2]) {
      linesWon++;
      matchedCoordinates.push("0-0", "1-1", "2-2");
    }
    if (g[0][2] === g[1][1] && g[1][1] === g[2][0]) {
      linesWon++;
      matchedCoordinates.push("0-2", "1-1", "2-0");
    }

    setWinningCells([...new Set(matchedCoordinates)]);

    let winAmount = 0;
    if (linesWon === 0) {
      setMessage("TRY AGAIN!");
    } else if (linesWon >= 3) {
      winAmount = appliedBet * 25;
      setMessage("🏆 🎉 MEGA JACKPOT!!! 🎉 🏆");
    } else if (linesWon === 2) {
      winAmount = appliedBet * 10;
      setMessage("🔥 DOUBLE LINE WIN! 🔥");
    } else {
      winAmount = appliedBet * 4;
      setMessage("💰 LINE WIN! 💰");
    }

    const finalWalletAmount = balanceContext + winAmount;
    setLastWin(winAmount);
    setCredits(finalWalletAmount);
    await MoneyManager.saveCredits(finalWalletAmount);
  };

  const rodScaleY = leverY.interpolate({
    inputRange: [0, LEVER_MAX_DRAG],
    outputRange: [1, 0.3],
  });

  const disableButtons = spinning || credits < bet;

  return (
    <ImageBackground source={require("../../assets/images/background/background.jpg")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.titleText}>LAS CHRISTMAS</Text>
          <Text style={styles.subtitleText}>9-LINE SLOTS</Text>
        </View>

        <View style={styles.gameLayout}>
          <View style={styles.machineCabinet}>
            <View style={styles.ledDisplay}>
              <Text style={styles.ledText}>{message}</Text>
            </View>
            
            <View style={styles.glassWindow}>
              {grid.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.reelRow}>
                  {row.map((symbol, colIndex) => {
                    const isWinningCell = winningCells.includes(`${rowIndex}-${colIndex}`);
                    return (
                      <Animated.View 
                        key={colIndex} 
                        style={[
                          styles.reel,
                          isWinningCell && {
                            borderColor: "#4cd137",
                            borderWidth: 3,
                            backgroundColor: "#ebfbe7",
                            shadowColor: "#4cd137",
                            shadowRadius: 14,
                            shadowOpacity: glowAnim,
                            transform: [{ scale: glowAnim.interpolate({ inputRange: [0.2, 1], outputRange: [1, 1.04] }) }]
                          }
                        ]}
                      >
                        <Text style={styles.emoji}>{symbol}</Text>
                      </Animated.View>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={styles.dashboardRow}>
              <View style={styles.dashboardStat}>
                <Text style={styles.statLabel}>TOTAL CREDITS</Text>
                <Text style={[styles.statValue, { color: '#00ffcc' }]}>${credits}</Text>
              </View>
              <View style={styles.dashboardStat}>
                <Text style={styles.statLabel}>CURRENT BET</Text>
                <Text style={[styles.statValue, { color: '#ffcc00' }]}>{bet}</Text>
              </View>
              <View style={styles.dashboardStat}>
                <Text style={styles.statLabel}>LAST WIN</Text>
                <Text style={[styles.statValue, { color: '#ff0055' }]}>{lastWin > 0 ? `$${lastWin}` : '—'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.leverTrack}>
            <View style={styles.leverBase} />
            <Animated.View style={[ styles.leverRod, { transform: [{ scaleY: rodScaleY }], transformOrigin: "bottom" }]} />
            <Animated.View {...(!disableButtons && bet > 0 ? panResponder.panHandlers : {})} style={[ styles.leverKnob, { transform: [{ translateY: leverY }] }, (disableButtons || bet === 0) && styles.leverKnobDisabled]} />
          </View>
        </View>

        <View style={styles.buttonConsoleDeck}>
          <TouchableOpacity style={[styles.arcadeButton, styles.blueBtn, spinning && styles.disabledBtn]} onPress={() => changeBet(-5)} disabled={spinning}>
            <Text style={styles.btnText}>BET -5</Text>
          </TouchableOpacity>

          {/* Core Custom Bet Terminal Block aligned to deck dimensions */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.customBetInput, spinning && styles.disabledInput]}
              keyboardType="number-pad"
              value={bet === 0 ? "" : bet.toString()}
              onChangeText={handleCustomBetInput}
              maxLength={6}
              editable={!spinning}
              placeholder="0"
              placeholderTextColor="#555"
              selectTextOnFocus
            />
          </View>

          <TouchableOpacity style={[styles.arcadeButton, styles.blueBtn, spinning && styles.disabledBtn]} onPress={() => changeBet(5)} disabled={spinning}>
            <Text style={styles.btnText}>BET +5</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.arcadeButton, styles.spinBtn, (disableButtons || bet === 0) && styles.disabledBtn]} onPress={triggerSpin} disabled={disableButtons || bet === 0}>
            <Text style={styles.spinBtnText}>SPIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  headerContainer: { alignItems: 'center', marginBottom: 20 },
  titleText: { fontSize: 36, fontWeight: "900", color: "#ff0055", letterSpacing: 4, textShadowColor: "#ff0055", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  subtitleText: { fontSize: 14, fontWeight: "bold", color: "#00ffff", letterSpacing: 6, textShadowColor: "#00ffff", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  gameLayout: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  machineCabinet: { backgroundColor: "#1e1e24", padding: 16, borderRadius: 23, borderWidth: 6, borderColor: "#4d4d5a", shadowColor: "#000", shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.6, shadowRadius: 15, elevation: 12, width: 300 },
  ledDisplay: { backgroundColor: "#050505", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, borderWidth: 2, borderColor: "#333", marginBottom: 15, alignItems: 'center' },
  ledText: { color: '#ff3333', fontWeight: 'bold', fontSize: 14, letterSpacing: 1, textAlign: 'center' },
  glassWindow: { flexDirection: "column", backgroundColor: "#111", padding: 8, borderRadius: 14, borderWidth: 3, borderColor: "#ffcc00", gap: 6 },
  reelRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  reel: { backgroundColor: "#fff", flex: 1, height: 75, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: '#ccc', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4 },
  emoji: { fontSize: 34 },
  dashboardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, backgroundColor: '#111', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#444' },
  dashboardStat: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 9, fontWeight: 'bold', color: '#888', marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: '900' },
  leverTrack: { width: 50, height: 240, alignItems: "center", justifyContent: "flex-start", marginLeft: 8, position: "relative" },
  leverBase: { width: 26, height: 40, backgroundColor: "#2c2c35", borderRadius: 6, borderWidth: 3, borderColor: "#57586e", position: "absolute", bottom: 40 },
  leverRod: { width: 12, height: 100, backgroundColor: "#dcdde1", borderLeftWidth: 3, borderColor: "#f5f6fa", position: "absolute", bottom: 65, zIndex: 1 },
  leverKnob: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#e84118", borderWidth: 3, borderColor: "#fbc531", position: "absolute", top: 30, zIndex: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 6 },
  leverKnobDisabled: { backgroundColor: "#718093", borderColor: "#4f5d73" },
  
  buttonConsoleDeck: { flexDirection: 'row', backgroundColor: '#2f3640', padding: 12, borderRadius: 16, marginTop: 25, borderWidth: 3, borderColor: '#718093', width: 350, justifyContent: 'space-between', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 8 },
  arcadeButton: { paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10, justifyContent: 'center', alignItems: 'center', minWidth: 65, borderBottomWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3 },
  blueBtn: { backgroundColor: '#00a8ff', borderBottomColor: '#0088cc' },
  spinBtn: { backgroundColor: '#4cd137', borderBottomColor: '#44bd32', minWidth: 80 },
  disabledBtn: { backgroundColor: '#718093', borderBottomColor: '#2f3640', opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  spinBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  inputWrapper: { width: 70, height: 42, backgroundColor: '#000', borderRadius: 8, borderWidth: 2, borderColor: '#ffcc00', justifyContent: 'center', alignItems: 'center' },
  customBetInput: { width: '100%', height: '100%', color: '#ffcc00', fontSize: 16, fontWeight: '900', textAlign: 'center', padding: 0 },
  disabledInput: { color: '#555', opacity: 0.7 }
});