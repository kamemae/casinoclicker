import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Animated, GestureResponderEvent, ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";

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

// --- PHYSICS CONFIGURATION ENGINE ---
const BOARD_WIDTH = 300;
const BOARD_HEIGHT = 380;
const ROWS = 8;
const BALL_RADIUS = 7;
const PEG_RADIUS = 3.5;
const GRAVITY = 0.18;
const BOUNCE_DAMPING_Y = -0.4;
const BOUNCE_DAMPING_X = 0.5;

// Prize bucket multipliers layout (Symmetric classical layout)
const MULTIPLIERS = [5.0, 2.0, 1.2, 0.5, 0.2, 0.5, 1.2, 2.0, 5.0];

interface BallState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isDead: boolean;
  animX: Animated.Value;
  animY: Animated.Value;
}

interface Peg {
  x: number;
  y: number;
}

// Generate peg board coordinate map dynamically
const generatePegs = (): Peg[] => {
  const pegsList: Peg[] = [];
  const startY = 40;
  const rowSpacing = (BOARD_HEIGHT - 80) / ROWS;

  for (let r = 0; r < ROWS; r++) {
    const pegCount = r + 3; 
    const rowWidth = (pegCount - 1) * 26;
    const startX = (BOARD_WIDTH - rowWidth) / 2;
    const currentY = startY + r * rowSpacing;

    for (let i = 0; i < pegCount; i++) {
      pegsList.push({
        x: startX + i * 26,
        y: currentY,
      });
    }
  }
  return pegsList;
};

const PEGS_MAP = generatePegs();

// --- MAIN INTERFACE MODULE ---
export default function PlinkoScreen() {
  const isFocused = useIsFocused();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const physicsFrameRef = useRef<number | null>(null);

  // Audio Hook Engine Instances — Only win audio kept
  //const winAudioSource = require("../../assets/audio/base/money.mp3");
  const winAudioSource = require("../../assets/audio/base/money.mp3");
  const winPlayer = useAudioPlayer(winAudioSource);

  // App Ecosystem States
  const [credits, setCredits] = useState<number>(0);
  const [bet, setBet] = useState<number>(10);
  const [balls, setBalls] = useState<BallState[]>([]);
  const ballsRef = useRef<BallState[]>([]);
  const nextBallId = useRef<number>(0);
  const [message, setMessage] = useState<string>("TAP THE BOARD DIRECTLY TO DROP A BALL");

  const currentBetRef = useRef(bet);
  useEffect(() => {
    currentBetRef.current = bet;
  }, [bet]);

  // Sync state reference to bridge closure thread safely
  useEffect(() => {
    ballsRef.current = balls;
  }, [balls]);

  // Load Credits Balance
  useEffect(() => {
    if (isFocused) {
      const loadInitialBalance = async () => {
        const currentBalance = await MoneyManager.getCredits();
        setCredits(currentBalance);
      };
      loadInitialBalance();
    }
  }, [isFocused]);

  // Ambient Neon LED loop setup
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
  }, [pulseAnim]);

  // Start continuous calculations when active balls are present
  useEffect(() => {
    if (balls.length > 0 && !physicsFrameRef.current) {
      physicsFrameRef.current = requestAnimationFrame(updatePhysicsLoop);
    }
    return () => {
      if (physicsFrameRef.current) {
        cancelAnimationFrame(physicsFrameRef.current);
        physicsFrameRef.current = null;
      }
    };
  }, [balls]);

  const changeBet = (amount: number) => {
    const targetBet = bet + amount;
    if (targetBet > 0 && targetBet <= credits) {
      setBet(targetBet);
    }
  };

  const handleCustomBetInput = (text: string) => {
    const sanitizedText = text.replace(/[^0-9]/g, "");
    if (sanitizedText === "") {
      setBet(0);
      return;
    }
    const parsedBet = parseInt(sanitizedText, 10);
    if (parsedBet <= credits) {
      setBet(parsedBet);
    } else {
      setBet(credits);
    }
  };

  const updateCreditsAndPersist = async (newCreditsValue: number) => {
    setCredits(newCreditsValue);
    await MoneyManager.saveCredits(newCreditsValue);
  };

  // --- CORE KINETIC PHYSICS LOOP ---
  const updatePhysicsLoop = () => {
    let currentBalls = [...ballsRef.current];
    if (currentBalls.length === 0) {
      physicsFrameRef.current = null;
      return;
    }

    let stateChanged = false;
    const deadIds: number[] = [];

    currentBalls = currentBalls.map((ball) => {
      if (ball.isDead) return ball;

      let nextNy = ball.y + ball.vy;
      let nextNx = ball.x + ball.vx;
      let nextVy = ball.vy + GRAVITY;
      let nextVx = ball.vx;

      // Peg collision calculations
      for (const peg of PEGS_MAP) {
        const dx = nextNx - peg.x;
        const dy = nextNy - peg.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = BALL_RADIUS + PEG_RADIUS;

        if (distance < minDistance) {
          const nx = dx / distance;
          const ny = dy / distance;

          const dotProduct = nextVx * nx + nextVy * ny;
          nextVx = (nextVx - 2 * dotProduct * nx) * BOUNCE_DAMPING_X;
          nextVy = (nextVy - 2 * dotProduct * ny) * BOUNCE_DAMPING_Y;

          nextVx += (Math.random() - 0.5) * 0.4;

          nextNx = peg.x + nx * minDistance;
          nextNy = peg.y + ny * minDistance;
          break; 
        }
      }

      // Check side wall constraints
      if (nextNx - BALL_RADIUS < 0) {
        nextNx = BALL_RADIUS;
        nextVx = -nextVx * BOUNCE_DAMPING_X;
      } else if (nextNx + BALL_RADIUS > BOARD_WIDTH) {
        nextNx = BOARD_WIDTH - BALL_RADIUS;
        nextVx = -nextVx * BOUNCE_DAMPING_X;
      }

      // Bottom bucket score calculation trigger zone
      if (nextNy >= BOARD_HEIGHT - 20) {
        deadIds.push(ball.id);
        const bucketIndex = Math.floor((nextNx / BOARD_WIDTH) * MULTIPLIERS.length);
        const validatedIndex = Math.max(0, Math.min(bucketIndex, MULTIPLIERS.length - 1));
        handleScorePayout(MULTIPLIERS[validatedIndex]);
        
        return { ...ball, isDead: true };
      }

      ball.animX.setValue(nextNx);
      ball.animY.setValue(nextNy);

      stateChanged = true;
      return { ...ball, x: nextNx, y: nextNy, vx: nextVx, vy: nextVy };
    });

    const activeRemainingBalls = currentBalls.filter(b => !deadIds.includes(b.id));

    if (stateChanged || deadIds.length > 0) {
      setBalls(activeRemainingBalls);
    }

    if (activeRemainingBalls.length > 0) {
      physicsFrameRef.current = requestAnimationFrame(updatePhysicsLoop);
    } else {
      physicsFrameRef.current = null;
    }
  };

  // Handles logic whether triggered from the bottom button or a raw board touch event
  const handleDropBall = async (customX?: number) => {
    const activeBet = currentBetRef.current;
    const freshCredits = await MoneyManager.getCredits();

    if (activeBet <= 0) {
      setMessage("🚫 CHOOSE A VALID WAGER! 🚫");
      return;
    }
    if (freshCredits < activeBet) {
      setMessage("🚫 INSUFFICIENT CREDITS! 🚫");
      return;
    }

    const balanceAfterBet = freshCredits - activeBet;
    await updateCreditsAndPersist(balanceAfterBet);

    // Determine target drop coordinate. Default to center if button pressed, otherwise use press spot
    let targetX = customX !== undefined ? customX : BOARD_WIDTH / 2;
    
    // Safety boundaries (prevents dropping a ball stuck entirely inside a wall boundary)
    const minSafetyBound = BALL_RADIUS + 2;
    const maxSafetyBound = BOARD_WIDTH - BALL_RADIUS - 2;
    targetX = Math.max(minSafetyBound, Math.min(targetX, maxSafetyBound));

    // Subtle micro-variance injection
    const startX = targetX + (Math.random() - 0.5) * 4;
    const startY = 10;

    const newBall: BallState = {
      id: nextBallId.current++,
      x: startX,
      y: startY,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0,
      isDead: false,
      animX: new Animated.Value(startX),
      animY: new Animated.Value(startY),
    };

    setBalls(prev => [...prev, newBall]);
    setMessage("🔮 GRAVITY TAKES THE BALL... 🔮");
  };

  // Extracts exact native X coordinates when a player strikes the surface window glass
  const handleBoardTouchPress = (evt: GestureResponderEvent) => {
    const pressedX = evt.nativeEvent.locationX;
    handleDropBall(pressedX);
  };

  const handleScorePayout = async (multiplier: number) => {
    const originalBet = currentBetRef.current;
    const calculationPayout = Math.floor(originalBet * multiplier);
    
    const freshCredits = await MoneyManager.getCredits();
    const cleanFinalTotal = freshCredits + calculationPayout;
    
    await updateCreditsAndPersist(cleanFinalTotal);
    
    if (winPlayer) winPlayer.play();
    setMessage(`💥 x${multiplier}! WON: $${calculationPayout} 💥`);
  };

  const glowRadius = pulseAnim.interpolate({
    inputRange: [0.4, 1],
    outputRange: [6, 16],
  });

  return (
    <ImageBackground source={require("../../assets/images/background/background.jpg")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>

        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={styles.titleText}>PEDO-DROP</Text>
          <Animated.Text
            style={[
              styles.subtitleText,
              {
                textShadowRadius: glowRadius,
                opacity: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.8, 1] }),
              },
            ]}
          >
            Plinko
          </Animated.Text>
        </View>

        {/* Central Machine Cabinet */}
        <View style={styles.machineCabinet}>

          {/* LED Banner Display */}
          <View style={styles.ledDisplay}>
            <Text style={styles.ledText}>{message}</Text>
          </View>

          {/* Main Virtual Display Playmat Window (Touchable Interaction Layer Enabled) */}
          <TouchableWithoutFeedback onPress={handleBoardTouchPress}>
            <View style={styles.glassWindow}>
              
              {/* Tap Indicator Hint Overlay */}
              <View style={styles.tapPromptOverlay}>
                <Text style={styles.tapPromptText}>⚡ TAP ANYWHERE TO DROP ⚡</Text>
              </View>

              {/* Draw Static Peg Grid array matrix */}
              {PEGS_MAP.map((peg, index) => (
                <View
                  key={`peg-${index}`}
                  style={[
                    styles.pegNode,
                    {
                      left: peg.x - PEG_RADIUS,
                      top: peg.y - PEG_RADIUS,
                    },
                  ]}
                />
              ))}

              {/* Render Active Kinetic Ball Entities */}
              {balls.map((ball) => (
                <Animated.View
                  key={`ball-${ball.id}`}
                  style={[
                    styles.ballNode,
                    {
                      transform: [
                        { translateX: ball.animX },
                        { translateY: ball.animY },
                      ],
                    },
                  ]}
                />
              ))}

              {/* Bottom Multiplier Target Matrix */}
              <View style={styles.multiplierBar}>
                {MULTIPLIERS.map((mult, index) => (
                  <View key={`mult-${index}`} style={styles.bucketColumn}>
                    <Text style={[styles.bucketLabelText, mult >= 2 ? styles.highWinText : styles.lowWinText]}>
                      {mult}x
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>

          {/* Core Stat Dashboard Panel */}
          <View style={styles.dashboardRow}>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>TOTAL CREDITS</Text>
              <Text style={[styles.statValue, { color: "#00ffcc" }]}>${credits}</Text>
            </View>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>STAKE VALUE</Text>
              <Text style={[styles.statValue, { color: "#ffcc00" }]}>{bet}</Text>
            </View>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>BALLS LIVE</Text>
              <Text style={[styles.statValue, { color: "#ff0055" }]}>{balls.length}</Text>
            </View>
          </View>
        </View>

        {/* Unified Bottom Console Control Deck */}
        <View style={styles.buttonConsoleDeck}>
          <TouchableOpacity style={[styles.arcadeButton, styles.blueBtn]} onPress={() => changeBet(-5)}>
            <Text style={styles.btnText}>BET -5</Text>
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.customBetInput}
              keyboardType="number-pad"
              value={bet === 0 ? "" : bet.toString()}
              onChangeText={handleCustomBetInput}
              maxLength={6}
              placeholder="0"
              placeholderTextColor="#555"
              selectTextOnFocus
            />
          </View>

          <TouchableOpacity style={[styles.arcadeButton, styles.blueBtn]} onPress={() => changeBet(5)}>
            <Text style={styles.btnText}>BET +5</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.arcadeButton, styles.spinBtn, (credits < bet || bet === 0) && styles.disabledBtn]} onPress={() => handleDropBall()}>
            <Text style={styles.spinBtnText}>DROP</Text>
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

  glassWindow: { backgroundColor: "#0b0c10", borderRadius: 14, borderWidth: 3, borderColor: "#ffcc00", height: BOARD_HEIGHT, width: BOARD_WIDTH, position: "relative", overflow: "hidden" },
  
  tapPromptOverlay: { position: "absolute", top: 12, left: 0, right: 0, alignItems: "center", opacity: 0.35, pointerEvents: "none" },
  tapPromptText: { color: "#00ffff", fontSize: 9, fontWeight: "bold", letterSpacing: 1 },

  pegNode: { position: "absolute", width: PEG_RADIUS * 2, height: PEG_RADIUS * 2, borderRadius: PEG_RADIUS, backgroundColor: "#00ffff", shadowColor: "#00ffff", shadowRadius: 3, shadowOpacity: 0.8, elevation: 2 },
  ballNode: { position: "absolute", width: BALL_RADIUS * 2, height: BALL_RADIUS * 2, borderRadius: BALL_RADIUS, backgroundColor: "#ff0055", left: -BALL_RADIUS, top: -BALL_RADIUS, shadowColor: "#ff0055", shadowRadius: 4, shadowOpacity: 0.9, elevation: 4 },

  multiplierBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 26, flexDirection: "row", backgroundColor: "#1f2833", borderTopWidth: 2, borderColor: "#ffcc00" },
  bucketColumn: { flex: 1, justifyContent: "center", alignItems: "center", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.15)" },
  bucketLabelText: { fontSize: 8, fontWeight: "900" },
  highWinText: { color: "#4cd137" },
  lowWinText: { color: "#ff9f43" },

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