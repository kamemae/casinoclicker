import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Animated, ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

// --- MONEY MANAGER STORAGE ENGINE ---
const CREDITS_KEY = "@user_total_credits";
const DEFAULT_INITIAL_CREDITS = 10000;

export const MoneyManager = {
  getCredits: async (): Promise<number> => {
    try {
      const stored = await AsyncStorage.getItem(CREDITS_KEY);
      if (stored !== null) {
        return parseInt(stored, 10);
      }
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

// --- GAME LOGIC UTILITIES ---
const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

interface Card {
  suit: string;
  value: string;
}

const generateDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
  return shuffle(deck);
};

const shuffle = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

const calculateScore = (hand: Card[]): number => {
  let score = 0;
  let aces = 0;
  for (const card of hand) {
    if (["J", "Q", "K"].includes(card.value)) {
      score += 10;
    } else if (card.value === "A") {
      score += 11;
      aces += 1;
    } else {
      score += parseInt(card.value, 10);
    }
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
};

function AnimatedCard({ card, isHidden }: { card: Card; isHidden: boolean }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [card]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [25, 0],
  });

  const isRed = ["♥", "♦"].includes(card.suit);

  return (
    <Animated.View style={[styles.card, isHidden && styles.cardBack, { opacity: animatedValue, transform: [{ translateY }] }]}>
      {isHidden ? (
        <Text style={styles.cardBackSymbol}>🕹️</Text>
      ) : (
        <>
          <Text style={[styles.cardValue, isRed && styles.redText]}>{card.value}</Text>
          <Text style={[styles.cardSuit, isRed && styles.redText]}>{card.suit}</Text>
        </>
      )}
    </Animated.View>
  );
}

// --- MAIN INTERFACE MODULE ---
export default function HomeScreen() {
  const isFocused = useIsFocused();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const shuffleDeckAnim = useRef(new Animated.Value(0)).current;

  // Audio Engine Hook Instances via expo-audio
  const cardPlaceAudioSource = require("../../assets/audio/base/cards/place1.mp3");
  const shuffleAudioSource = require("../../assets/audio/base/cards/shuffle.mp3");

  const cardPlayer = useAudioPlayer(cardPlaceAudioSource);
  const shufflePlayer = useAudioPlayer(shuffleAudioSource);

  // Game Playmat Ecosystem States
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const [bet, setBet] = useState<number>(10);
  const [gameState, setGameState] = useState<"betting" | "shuffling" | "dealing" | "player-turn" | "dealer-turn" | "ended">("betting");
  const [message, setMessage] = useState<string>("TAP TABLE TO DEAL / START GAME");

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
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
  }, [pulseAnim]);

  // Randomizer function for choosing card placing audios smoothly
  const playRandomCardPlacementSound = () => {
    const sounds = [
      require("../../assets/audio/base/cards/place1.mp3"),
      require("../../assets/audio/base/cards/place2.mp3"),
    ];
    const pickedSound = sounds[Math.floor(Math.random() * sounds.length)];
    
    if (cardPlayer) {
      cardPlayer.replace(pickedSound);
      cardPlayer.play();
    }
  };

  const changeBet = (amount: number) => {
    if (gameState !== "betting") return;
    const targetBet = bet + amount;
    if (targetBet > 0 && targetBet <= credits) {
      setBet(targetBet);
    }
  };

  const handleCustomBetInput = (text: string) => {
    if (gameState !== "betting") return;
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

  const handleDeal = async () => {
    if (gameState !== "betting") return;

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

    setGameState("dealing");
    setMessage("🎲 PREPARING THE CARDS... 🎲");

    const balanceAfterBet = freshCredits - activeBet;
    await updateCreditsAndPersist(balanceAfterBet);

    const activeDeck = generateDeck();
    const pCard1 = activeDeck.pop()!;
    const dCard1 = activeDeck.pop()!;
    const pCard2 = activeDeck.pop()!;
    const dCard2 = activeDeck.pop()!;

    setDeck(activeDeck);

    // 1st Card: Player
    setTimeout(() => {
      setMessage("🃏 PLAYER RECEIVES FIRST CARD...");
      playRandomCardPlacementSound();
      setPlayerHand([pCard1]);
    }, 300);

    // 2nd Card: Dealer
    setTimeout(() => {
      setMessage("👀 DEALER GETS ONE UP...");
      playRandomCardPlacementSound();
      setDealerHand([dCard1]);
    }, 1200);

    // 3rd Card: Player
    setTimeout(() => {
      setMessage("🃏 PLAYER RECEIVES SECOND CARD...");
      playRandomCardPlacementSound();
      setPlayerHand([pCard1, pCard2]);
    }, 2300);

    // 4th Card: Dealer (Down Card)
    setTimeout(() => {
      setMessage("🤫 DEALER SLIDES THE HOLE CARD...");
      playRandomCardPlacementSound();
      const finalDealerHand = [dCard1, dCard2];
      setDealerHand(finalDealerHand);

      const finalPlayerHand = [pCard1, pCard2];
      const playerScore = calculateScore(finalPlayerHand);
      const dealerScore = calculateScore(finalDealerHand);

      setTimeout(async () => {
        const potentialDealerBlackjack = ["A", "10", "J", "Q", "K"].includes(dCard1.value);

        if (potentialDealerBlackjack) {
          setMessage("⚠️ DEALER PEEKS FOR BLACKJACK... ⚠️");
          await new Promise((resolve) => setTimeout(resolve, 1000));

          if (dealerScore === 21) {
            setGameState("ended");
            if (playerScore === 21) {
              await updateCreditsAndPersist(balanceAfterBet + activeBet);
              setMessage("🤝 BOTH HAVE BLACKJACK! PUSH TIE 🤝");
            } else {
              setMessage("💥 DEALER HAS BLACKJACK! YOU LOSE! 💥");
            }
            return;
          }
        }

        if (playerScore === 21) {
          setGameState("ended");
          await updateCreditsAndPersist(balanceAfterBet + Math.floor(activeBet * 2.5));
          setMessage("💥 NATURAL BLACKJACK! 💥");
        } else {
          setGameState("player-turn");
          setMessage("YOUR MOVE: HIT OR STAND?");
        }
      }, 700);

    }, 3500);
  };

  const handleHit = () => {
    if (gameState !== "player-turn") return;

    const workingDeck = [...deck];
    const newCard = workingDeck.pop()!;
    const updatedHand = [...playerHand, newCard];

    setDeck(workingDeck);
    playRandomCardPlacementSound();
    setPlayerHand(updatedHand);

    if (calculateScore(updatedHand) > 21) {
      setGameState("ended");
      setMessage("💥 BUST! DEALER WINS 💥");
    }
  };

  const handleStand = () => {
    if (gameState !== "player-turn") return;
    setGameState("dealer-turn");
    setMessage("⏳ REVEALING HOLE CARD... ⏳");

    setTimeout(() => {
      runDealerAI([...deck], [...dealerHand]);
    }, 1000);
  };

  const runDealerAI = (currentDeck: Card[], currentDealerHand: Card[]) => {
    let workingDeck = [...currentDeck];
    let workingDealerHand = [...currentDealerHand];
    let dealerScore = calculateScore(workingDealerHand);

    // Tracking loop iterations to simulate interval timing between audio hits
    let delayCounter = 0;

    const pullDealerCardsInterval = setInterval(() => {
      if (calculateScore(workingDealerHand) < 17) {
        const drawnCard = workingDeck.pop()!;
        workingDealerHand.push(drawnCard);
        playRandomCardPlacementSound();
        setDealerHand([...workingDealerHand]);
      } else {
        clearInterval(pullDealerCardsInterval);
        setDeck(workingDeck);
        const playerScore = calculateScore(playerHand);
        evaluateFinalOutcome(playerScore, calculateScore(workingDealerHand));
      }
    }, 800);
  };

  const evaluateFinalOutcome = async (playerScore: number, dealerScore: number) => {
    setGameState("ended");
    const activeBet = currentBetRef.current;

    if (dealerScore > 21) {
      await updateCreditsAndPersist(credits + activeBet * 2);
      setMessage("🏆 DEALER BUSTS! YOU WIN! 🏆");
    } else if (playerScore > dealerScore) {
      await updateCreditsAndPersist(credits + activeBet * 2);
      setMessage("🏆 HIGHER SCORE! YOU WIN! 🏆");
    } else if (playerScore < dealerScore) {
      setMessage("TRY AGAIN!");
    } else {
      await updateCreditsAndPersist(credits + activeBet);
      setMessage("🤝 PUSH (TIE HAND) 🤝");
    }
  };

  // Triggers mechanical audio shuffle loops synchronized with component layout overlays
  const handleResetGame = () => {
    setGameState("shuffling");
    setMessage("🔀 SHUFFLING DECK SYSTEM... 🔀");
    
    if (shufflePlayer) {
      shufflePlayer.seekTo(0);
      shufflePlayer.play();
    }

    // Kinetic card deck horizontal slide animation loop
    shuffleDeckAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(shuffleDeckAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(shuffleDeckAnim, { toValue: -1, duration: 50, useNativeDriver: true }),
      ]),
      { iterations: 6 }
    ).start();

    // Reset layout attributes after shuffle track runs out of duration
    setTimeout(() => {
      setPlayerHand([]);
      setDealerHand([]);
      setGameState("betting");
      setMessage("TAP TABLE TO DEAL / START GAME");
    }, 1600);
  };

  const handleTableSurfaceTap = () => {
    if (gameState === "betting") {
      if (credits >= bet && bet > 0) {
        handleDeal();
      }
    } else if (gameState === "ended") {
      handleResetGame();
    }
  };

  const glowRadius = pulseAnim.interpolate({
    inputRange: [0.4, 1],
    outputRange: [6, 16],
  });

  const shuffleTranslateX = shuffleDeckAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-30, 30],
  });

  const showDealerScoreValue = gameState !== "player-turn" && gameState !== "dealing" && gameState !== "shuffling";
  const pScore = playerHand.length > 0 ? calculateScore(playerHand) : 0;
  const dScore = dealerHand.length > 0 ? calculateScore(dealerHand) : 0;
  const isPlayerTurn = gameState === "player-turn";

  return (
    <ImageBackground source={require("../../assets/images/background/background.jpg")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>

        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={styles.titleText}>BLOW-JACK</Text>
          <Animated.Text
            style={[
              styles.subtitleText,
              {
                textShadowRadius: glowRadius,
                opacity: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.8, 1] }),
              },
            ]}
          >
            Blackjack
          </Animated.Text>
        </View>

        {/* Central Machine Cabinet */}
        <View style={styles.machineCabinet}>

          {/* LED Banner Display */}
          <View style={styles.ledDisplay}>
            <Text style={styles.ledText}>{message}</Text>
          </View>

          {/* Main Visual Display Window */}
          <TouchableOpacity 
            style={[
              styles.glassWindow, 
              gameState === "betting" && styles.tablePulseHighlight,
              gameState === "ended" && styles.tableResetHighlight
            ]} 
            onPress={handleTableSurfaceTap} 
            disabled={isPlayerTurn || gameState === "dealing" || gameState === "dealer-turn" || gameState === "shuffling"}
            activeOpacity={0.85}
          >
            {gameState === "betting" && (
              <View style={styles.hologramOverlay}>
                <Text style={styles.hologramText}>⚡ TAP TABLE TO DEAL ⚡</Text>
              </View>
            )}
            
            {gameState === "ended" && (
              <View style={styles.hologramOverlay}>
                <Text style={[styles.hologramText, { color: "#4cd137" }]}>✨ TAP TABLE TO SHUFFLE & PLAY ✨</Text>
              </View>
            )}

            {gameState === "shuffling" && (
              <View style={styles.shuffleOverlayContainer}>
                <Animated.View style={[styles.deckShuffleStack, { transform: [{ translateX: shuffleTranslateX }] }]}>
                  <Text style={styles.cardBackSymbol}>🕹️</Text>
                </Animated.View>
                <Animated.View style={[styles.deckShuffleStack, { transform: [{ translateX: Animated.multiply(shuffleTranslateX, -1) }] }]}>
                  <Text style={styles.cardBackSymbol}>🕹️</Text>
                </Animated.View>
              </View>
            )}

            {/* Dealer Row */}
            <TouchableOpacity 
              style={[styles.handSection, isPlayerTurn && styles.activeHandHighlightDealer]}
              onPress={handleStand}
              disabled={!isPlayerTurn}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionLabel}>
                DEALER {showDealerScoreValue ? `(${dScore})` : "(?)"} {isPlayerTurn && "➡️ [STAND ZONE]"}
              </Text>
              <View style={styles.cardRow}>
                {dealerHand.map((card, idx) => (
                  <AnimatedCard
                    key={`${idx}-${card.value}-${card.suit}`}
                    card={card}
                    isHidden={(gameState === "player-turn" && idx === 1) || (gameState === "dealing" && idx === 1)}
                  />
                ))}
                {dealerHand.length === 0 && !styles.shuffleOverlayContainer && <View style={styles.cardEmptyPlaceholder} />}
              </View>
            </TouchableOpacity>

            {/* Player Row */}
            <TouchableOpacity 
              style={[styles.handSection, isPlayerTurn && styles.activeHandHighlightPlayer]}
              onPress={handleHit}
              disabled={!isPlayerTurn}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionLabel}>
                PLAYER ({pScore}) {isPlayerTurn && "➡️ [HIT ZONE]"}
              </Text>
              <View style={styles.cardRow}>
                {playerHand.map((card, idx) => (
                  <AnimatedCard
                    key={`${idx}-${card.value}-${card.suit}`}
                    card={card}
                    isHidden={false}
                  />
                ))}
                {playerHand.length === 0 && !styles.shuffleOverlayContainer && <View style={styles.cardEmptyPlaceholder} />}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Core Stat Dashboard Panel */}
          <View style={styles.dashboardRow}>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>TOTAL CREDITS</Text>
              <Text style={[styles.statValue, { color: "#00ffcc" }]}>${credits}</Text>
            </View>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>CURRENT BET</Text>
              <Text style={[styles.statValue, { color: "#ffcc00" }]}>{bet}</Text>
            </View>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>STAGE</Text>
              <Text style={[styles.statValue, { color: "#ff0055", fontSize: 11, marginTop: 3 }]}>
                {gameState.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Unified Bottom Console Control Deck */}
        <View style={styles.buttonConsoleDeck}>
          {gameState === "betting" ? (
            <>
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

              <TouchableOpacity style={[styles.arcadeButton, styles.spinBtn, (credits < bet || bet === 0) && styles.disabledBtn]} onPress={handleDeal} disabled={credits < bet || bet === 0}>
                <Text style={styles.spinBtnText}>DEAL</Text>
              </TouchableOpacity>
            </>
          ) : gameState === "player-turn" ? (
            <>
              <TouchableOpacity style={[styles.arcadeButton, styles.redBtn, { flex: 1 }]} onPress={handleHit}>
                <Text style={styles.spinBtnText}>HIT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.arcadeButton, styles.blueBtn, { flex: 1, minWidth: 100 }]} onPress={handleStand}>
                <Text style={styles.spinBtnText}>STAND</Text>
              </TouchableOpacity>
            </>
          ) : gameState === "ended" ? (
            <TouchableOpacity style={[styles.arcadeButton, styles.spinBtn, { flex: 1 }]} onPress={handleResetGame}>
              <Text style={styles.spinBtnText}>PLAY AGAIN</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.arcadeButton, styles.disabledBtn, { flex: 1 }]}>
              <Text style={styles.spinBtnText}>{gameState === "shuffling" ? "SHUFFLING..." : "DEALING..."}</Text>
            </View>
          )}
        </View>

      </View>
    </ImageBackground>
  );
}

// --- CORE ARCHITECTURE STYLES ---
const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  headerContainer: { alignItems: "center", marginBottom: 20 },
  titleText: { fontSize: 36, fontWeight: "900", color: "#ff0055", letterSpacing: 4, textShadowColor: "#ff0055", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  subtitleText: { fontSize: 14, fontWeight: "bold", color: "#00ffff", letterSpacing: 6, textShadowColor: "#00ffff", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },

  machineCabinet: { backgroundColor: "#1e1e24", padding: 16, borderRadius: 23, borderWidth: 6, borderColor: "#4d4d5a", shadowColor: "#000", shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.6, shadowRadius: 15, elevation: 12, width: 320 },
  ledDisplay: { backgroundColor: "#050505", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, borderWidth: 2, borderColor: "#333", marginBottom: 15, alignItems: "center" },
  ledText: { color: "#ff3333", fontWeight: "bold", fontSize: 13, letterSpacing: 0.5, textAlign: "center" },

  glassWindow: { backgroundColor: "#111", padding: 8, borderRadius: 14, borderWidth: 3, borderColor: "#ffcc00", justifyContent: "space-between", height: 230, width: "100%", position: "relative" },
  tablePulseHighlight: { borderColor: "#00ffff" },
  tableResetHighlight: { borderColor: "#4cd137" },
  
  hologramOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", zIndex: 10, borderRadius: 10, pointerEvents: "none" },
  hologramText: { color: "#00ffff", fontSize: 12, fontWeight: "bold", letterSpacing: 1, textAlign: "center", backgroundColor: "rgba(0,0,0,0.85)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,255,255,0.3)" },

  shuffleOverlayContainer: { ...StyleSheet.absoluteFillObject, flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: "rgba(17, 17, 17, 0.95)", zIndex: 20, borderRadius: 10, gap: 10 },
  deckShuffleStack: { width: 45, height: 64, backgroundColor: "#2f3640", borderRadius: 6, borderWidth: 2, borderColor: "#00ffff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4, elevation: 5 },

  handSection: { width: "100%", padding: 6, borderRadius: 8, zIndex: 1 },
  activeHandHighlightPlayer: { backgroundColor: "rgba(232, 65, 24, 0.15)", borderWidth: 1, borderColor: "rgba(232, 65, 24, 0.4)" },
  activeHandHighlightDealer: { backgroundColor: "rgba(0, 168, 255, 0.15)", borderWidth: 1, borderColor: "rgba(0, 168, 255, 0.4)" },
  sectionLabel: { color: "#888", fontSize: 9, fontWeight: "bold", letterSpacing: 1, marginBottom: 4 },
  cardRow: { flexDirection: "row", gap: 5, minHeight: 60, alignItems: "center" },
  
  card: { width: 40, height: 56, backgroundColor: "#ffffff", borderRadius: 6, padding: 4, justifyContent: "space-between", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },
  cardBack: { backgroundColor: "#2f3640", borderWidth: 2, borderColor: "#ff0055", justifyContent: "center", alignItems: "center" },
  cardBackSymbol: { fontSize: 14 },
  cardValue: { fontSize: 12, fontWeight: "bold", color: "#1e1e24" },
  cardSuit: { fontSize: 14, textAlign: "right", color: "#1e1e24", lineHeight: 14 },
  cardEmptyPlaceholder: { width: 40, height: 56, borderRadius: 6, borderWidth: 1, borderStyle: "dashed", borderColor: "#444" },
  redText: { color: "#d63031" },

  dashboardRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, backgroundColor: "#111", padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "#444" },
  dashboardStat: { alignItems: "center", flex: 1 },
  statLabel: { fontSize: 9, fontWeight: "bold", color: "#888", marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: "900" },

  buttonConsoleDeck: { flexDirection: "row", backgroundColor: "#2f3640", padding: 12, borderRadius: 16, marginTop: 25, borderWidth: 3, borderColor: "#718093", width: 340, justifyContent: "space-between", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 8 },
  arcadeButton: { paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10, justifyContent: "center", alignItems: "center", minWidth: 65, borderBottomWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3 },
  blueBtn: { backgroundColor: "#00a8ff", borderBottomColor: "#0088cc" },
  redBtn: { backgroundColor: "#e84118", borderBottomColor: "#c23616" },
  spinBtn: { backgroundColor: "#4cd137", borderBottomColor: "#44bd32", minWidth: 80 },
  disabledBtn: { backgroundColor: "#718093", borderBottomColor: "#2f3640", opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  spinBtnText: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },

  inputWrapper: { width: 70, height: 42, backgroundColor: "#000", borderRadius: 8, borderWidth: 2, borderColor: "#ffcc00", justifyContent: "center", alignItems: "center" },
  customBetInput: { width: "100%", height: "100%", color: "#ffcc00", fontSize: 16, fontWeight: "900", textAlign: "center", padding: 0 },
});