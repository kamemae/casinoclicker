import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Animated, ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

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
const TRACK_WIDTH = 280; 
const FINISH_LINE = 240;  
const TOTAL_HORSES = 5;
const FIXED_DURATION_MS = 12500; 
const POST_RACE_LOCKOUT_MS = 3000; 

interface HorseState {
  id: number;
  name: string;
  color: string;
  progress: number; 
  animX: Animated.Value;
}

interface HorseBehavior {
  baseSpeed: number; 
  currentSpeed: number; 
  targetSpeed: number; 
}

const DEFAULT_HORSES = [
  { id: 1, name: "Giga Niga", color: "#ff0055" },
  { id: 2, name: "Neon Spell", color: "#00ffff" },
  { id: 3, name: "Crypto Gej", color: "#ffcc00" },
  { id: 4, name: "Victor Fyda", color: "#00ff66" },
  { id: 5, name: "Tokyo Dick", color: "#af40ff" },
];

const ANIME_HORSES_NAMES = [
  "Gold Ship",
  "Tokai Teio",
  "Vodka",
  "Silence Suzuka",
  "Special Week"
];

export default function HorseRaceScreen() {
  const isFocused = useIsFocused();
  const raceFrameRef = useRef<number | null>(null);

  // Audio Hook Engines
  const horsePlayer = useAudioPlayer(require("../../assets/audio/base/horserace/horse.mp3"));
  const gallopPlayer = useAudioPlayer(require("../../assets/audio/base/horserace/gallop.mp3"));
  const umamusumePlayer = useAudioPlayer(require("../../assets/audio/base/horserace/e-umamusume.mp3"));

  // State Ecosystem
  const [credits, setCredits] = useState<number>(0);
  const [bet, setBet] = useState<number>(10);
  const [selectedHorseId, setSelectedHorseId] = useState<number>(1);
  const [isRacing, setIsRacing] = useState<boolean>(false);
  const [isLockedPostRace, setIsLockedPostRace] = useState<boolean>(false);
  const [tickerMessage, setTickerMessage] = useState<string>("SELECT A HORSE TO START THE DERBY");
  const [currentRaceNames, setCurrentRaceNames] = useState<string[]>(DEFAULT_HORSES.map(h => h.name));
  const [leaderId, setLeaderId] = useState<number | null>(null);
  const [isUmamusumeActive, setIsUmamusumeActive] = useState<boolean>(false);
  
  // Historical ledger configuration state
  const [previousWinner, setPreviousWinner] = useState<{ name: string; color: string } | null>(null);

  // Winner Presentation States
  const [showWinnerOverlay, setShowWinnerOverlay] = useState<boolean>(false);
  const [winningHorseInfo, setWinningHorseInfo] = useState<{ id: number; name: string; color: string; tierMessage: string; isUserWin: boolean } | null>(null);

  const [horses, setHorses] = useState<HorseState[]>(() =>
    DEFAULT_HORSES.map(h => ({ ...h, progress: 0, animX: new Animated.Value(0) }))
  );
  
  const horsesRef = useRef<HorseState[]>([]);
  const raceStartTimeRef = useRef<number>(0);
  const isFixedModeRef = useRef<boolean>(false);
  const predeterminedWinnerRef = useRef<number>(1);
  
  const behaviorsRef = useRef<HorseBehavior[]>([]);
  const fixedTargetMaxProgressRef = useRef<number[]>([]);

  useEffect(() => {
    horsesRef.current = horses;
  }, [horses]);

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
    return () => {
      if (raceFrameRef.current) cancelAnimationFrame(raceFrameRef.current);
    };
  }, []);

  const changeBet = (amount: number) => {
    if (isRacing || isLockedPostRace) return;
    const targetBet = bet + amount;
    if (targetBet > 0 && targetBet <= credits) {
      setBet(targetBet);
    }
  };

  const handleCustomBetInput = (text: string) => {
    if (isRacing || isLockedPostRace) return;
    const sanitizedText = text.replace(/[^0-9]/g, "");
    if (sanitizedText === "") {
      setBet(0);
      return;
    }
    const parsedBet = parseInt(sanitizedText, 10);
    setBet(parsedBet <= credits ? parsedBet : credits);
  };

  // --- ENGINE TICK LOOP ---
  const updateRaceLoop = (timestamp: number) => {
    if (!raceStartTimeRef.current) {
      raceStartTimeRef.current = timestamp;
    }

    const elapsed = timestamp - raceStartTimeRef.current;
    let internalHorses = [...horsesRef.current];
    let raceOver = false;
    let winningHorse: HorseState | null = null;

    if (isFixedModeRef.current) {
      const linearRatio = Math.min(elapsed / FIXED_DURATION_MS, 1);

      internalHorses = internalHorses.map((horse, idx) => {
        const isWinner = horse.id === predeterminedWinnerRef.current;
        const maxRange = fixedTargetMaxProgressRef.current[idx];
        
        const calculatedProgress = linearRatio * maxRange;
        horse.animX.setValue(calculatedProgress);

        if (linearRatio >= 1 && isWinner) {
          raceOver = true;
          winningHorse = horse;
        }

        return { ...horse, progress: calculatedProgress };
      });

    } else {
      internalHorses = internalHorses.map((horse, idx) => {
        if (raceOver) return horse;

        const behavior = behaviorsRef.current[idx];
        
        if (Math.random() < 0.15) {
          const shiftValue = (Math.random() - 0.5) * 2.0;
          behavior.targetSpeed = Math.max(0.8, Math.min(behavior.targetSpeed + shiftValue, 3.8));
        }

        behavior.currentSpeed += (behavior.targetSpeed - behavior.currentSpeed) * 0.08;
        
        const stepProgression = horse.progress + (behavior.baseSpeed * 0.4 + behavior.currentSpeed * 0.6);
        horse.animX.setValue(stepProgression);

        if (stepProgression >= FINISH_LINE) {
          raceOver = true;
          winningHorse = horse;
        }

        return { ...horse, progress: stepProgression };
      });
    }

    if (internalHorses.length > 0) {
      let currentMaxProgress = -1;
      let currentLeader = null;
      let leaderName = "";
      
      for (let i = 0; i < internalHorses.length; i++) {
        if (internalHorses[i].progress > currentMaxProgress) {
          currentMaxProgress = internalHorses[i].progress;
          currentLeader = internalHorses[i].id;
          leaderName = internalHorses[i].name;
        }
      }
      
      if (currentMaxProgress > 2) {
        setLeaderId(currentLeader);
        setTickerMessage(`🏃 LEADING: ${leaderName.toUpperCase()} 🏃`);
      } else {
        setLeaderId(null);
      }
    }

    setHorses(internalHorses);

    if (!raceOver) {
      raceFrameRef.current = requestAnimationFrame(updateRaceLoop);
    } else if (winningHorse) {
      handleRaceFinished(winningHorse, internalHorses);
    }
  };

  // --- START SEQUENCE CONTROLLER ---
  const handleStartRace = async () => {
    if (isRacing || isLockedPostRace || bet <= 0 || credits < bet) {
      if (credits < bet) setTickerMessage("🚫 INSUFFICIENT CREDITS BALANCE! 🚫");
      return;
    }

    setShowWinnerOverlay(false);
    setWinningHorseInfo(null);
    raceStartTimeRef.current = 0;
    setLeaderId(null);
    
    const playUmamusumeSpecial = Math.random() < 0.05; 
    isFixedModeRef.current = playUmamusumeSpecial;
    setIsUmamusumeActive(playUmamusumeSpecial);

    const namesList = playUmamusumeSpecial ? ANIME_HORSES_NAMES : DEFAULT_HORSES.map(h => h.name);
    setCurrentRaceNames(namesList);

    const activeRaceSetup = DEFAULT_HORSES.map((h, index) => ({
      ...h,
      name: namesList[index],
      progress: 0,
      animX: new Animated.Value(0)
    }));

    behaviorsRef.current = DEFAULT_HORSES.map(() => {
      const startingBase = 1.6 + Math.random() * 0.8;
      return {
        baseSpeed: startingBase,
        currentSpeed: startingBase,
        targetSpeed: startingBase
      };
    });

    if (playUmamusumeSpecial) {
      predeterminedWinnerRef.current = Math.floor(Math.random() * TOTAL_HORSES) + 1;
      
      fixedTargetMaxProgressRef.current = DEFAULT_HORSES.map((h, idx) => {
        if (h.id === predeterminedWinnerRef.current) return FINISH_LINE;
        const baselineDeficit = FINISH_LINE - 15 - (Math.random() * 20);
        return Math.min(baselineDeficit, FINISH_LINE - 5);
      });
    }

    setHorses(activeRaceSetup);
    setIsRacing(true);
    setTickerMessage("🏁 RACING... 🏁");

    const activeBalance = credits - bet;
    setCredits(activeBalance);
    await MoneyManager.saveCredits(activeBalance);

    try {
      if (gallopPlayer) { gallopPlayer.pause(); gallopPlayer.seekTo(0); }
      if (umamusumePlayer) { umamusumePlayer.pause(); umamusumePlayer.seekTo(0); }
      if (horsePlayer) { horsePlayer.pause(); horsePlayer.seekTo(0); }
    } catch (e) {
      console.error(e);
    }

    if (horsePlayer) horsePlayer.play();

    if (playUmamusumeSpecial && umamusumePlayer) {
      umamusumePlayer.play();
    } else if (gallopPlayer) {
      gallopPlayer.play();
    }

    raceFrameRef.current = requestAnimationFrame(updateRaceLoop);
  };

  // --- TERMINATION RESOLUTION ENGINE ---
  const handleRaceFinished = async (winner: HorseState, finalHorses: HorseState[]) => {
    setIsRacing(false);
    setIsLockedPostRace(true);
    if (raceFrameRef.current) cancelAnimationFrame(raceFrameRef.current);

    try {
      if (gallopPlayer) { gallopPlayer.pause(); gallopPlayer.seekTo(0); }
      if (umamusumePlayer) { umamusumePlayer.pause(); umamusumePlayer.seekTo(0); }
    } catch (e) {
      console.error(e);
    }

    const rankedHorses = [...finalHorses].sort((a, b) => b.progress - a.progress);
    const userHorsePlacement = rankedHorses.findIndex(h => h.id === selectedHorseId) + 1;

    let multiplier = 0;
    let tierMessage = "TICKET LOST";
    let isUserWin = false;

    if (userHorsePlacement === 1) {
      multiplier = 5;
      tierMessage = "1ST PLACE CHAMPION! (5x)";
      isUserWin = true;
    } else if (userHorsePlacement === 2) {
      multiplier = 1;
      tierMessage = "2ND PLACE! (1x)";
      isUserWin = true;
    } else if (userHorsePlacement === 3) {
      multiplier = 0.5;
      tierMessage = "3RD PLACE! (0.5x)";
      isUserWin = true;
    } else if (userHorsePlacement === 4) {
      tierMessage = "4TH PLACE! (0x)";
    } else {
      tierMessage = "5TH PLACE! (0x)";
    }

    const rewardPayout = Math.floor(bet * multiplier);
    const freshStorageBalance = await MoneyManager.getCredits();
    const balanceCalculator = freshStorageBalance + rewardPayout; 

    if (multiplier > 0) {
      setTickerMessage(`🏆 WINNER: ${winner.name}! PAID: +$${rewardPayout} 🏆`);
    } else {
      setTickerMessage(`❌ WINNER: ${winner.name}! PAID: +$0! ❌`);
    }

    setPreviousWinner({
      name: winner.name,
      color: winner.color
    });

    setWinningHorseInfo({
      id: winner.id,
      name: winner.name,
      color: winner.color,
      tierMessage: tierMessage,
      isUserWin: isUserWin
    });
    setShowWinnerOverlay(true);

    setCredits(balanceCalculator);
    await MoneyManager.saveCredits(balanceCalculator);

    setTimeout(() => {
      setIsLockedPostRace(false);
      setShowWinnerOverlay(false);
      setWinningHorseInfo(null);
      setLeaderId(null);
      setIsUmamusumeActive(false);
      setTickerMessage("SELECT A HORSE TO START THE DERBY");
      setCurrentRaceNames(DEFAULT_HORSES.map(h => h.name));
    }, POST_RACE_LOCKOUT_MS);
  };

  const isInteractionDisabled = isRacing || isLockedPostRace;

  return (
    <ImageBackground source={require("../../assets/images/background/background.jpg")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>

        {/* Dynamic Header Dashboard */}
        <View style={styles.headerContainer}>
          <Text style={[styles.titleText, isUmamusumeActive && styles.titleUmamusume]}>
            {isUmamusumeActive ? "PRETTY DERBY" : "HORSE RACE"}
          </Text>
          <Text style={styles.subtitleText}>{isUmamusumeActive ? "UMAMUSUME MODE!!!!" : "Horse racing game"}</Text>
        </View>

        {/* Machine Main Cabinet Frame */}
        <View style={styles.machineCabinet}>
          
          {/* Status Banner */}
          <View style={styles.ledDisplay}>
            <Text style={styles.ledText}>{tickerMessage}</Text>
          </View>

          {/* Virtual Track Arena Container */}
          <View style={styles.trackContainer}>
            <TouchableOpacity 
              activeOpacity={0.9} 
              disabled={isInteractionDisabled || bet === 0 || credits < bet}
              onPress={handleStartRace}
            >
              <View style={styles.stadiumWindow}>
                {horses.map((horse) => {
                  const isSelected = horse.id === selectedHorseId;
                  const isLeading = horse.id === leaderId;
                  return (
                    <View key={`track-lane-${horse.id}`} style={styles.trackLane}>
                      <View style={styles.laneLabelPlate}>
                        <Text style={[styles.laneLabelNumber, { color: horse.color }]}>{horse.id}</Text>
                      </View>

                      <View style={styles.runningField}>
                        <Animated.View
                          style={[
                            styles.horseRunnerEntity,
                            {
                              backgroundColor: horse.color,
                              transform: [{ translateX: horse.animX }],
                              borderColor: isSelected ? "#fff" : "transparent",
                              borderWidth: isSelected ? 2 : 0
                            }
                          ]}
                        >
                          {isLeading && (
                            <Text style={styles.crownDecoration}>👑</Text>
                          )}
                        </Animated.View>
                        <View style={styles.finishLineMarker} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </TouchableOpacity>

            {/* --- WINNER PODIUM OVERLAY SCREEN --- */}
            {showWinnerOverlay && winningHorseInfo && (
              <View style={styles.podiumOverlayPanel}>
                <View style={styles.podiumSpriteContainer}>
                  <Text style={styles.giantCrown}>👑</Text>
                  <View style={[styles.podiumHorseSprite, { backgroundColor: winningHorseInfo.color }]} />
                </View>

                <Text style={[styles.podiumWinnerText, { color: winningHorseInfo.color }]}>
                  {winningHorseInfo.name.toUpperCase()}
                </Text>
                
                <Text style={styles.podiumSubTitle}>FIRST PLACE CHAMPION</Text>
                
                <View style={[
                  styles.statusBadge, 
                  { backgroundColor: winningHorseInfo.isUserWin ? "#00ff6633" : "#ff005533",
                    borderColor: winningHorseInfo.isUserWin ? "#00ff66" : "#ff0055" }
                ]}>
                  <Text style={[styles.statusBadgeText, { color: winningHorseInfo.isUserWin ? "#00ff66" : "#ff0055" }]}>
                    {winningHorseInfo.tierMessage}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Horse Selector Console Matrix */}
          <Text style={styles.consoleSectionTitle}>SELECT YOUR STABLE RACER</Text>
          <View style={styles.horseSelectRow}>
            {DEFAULT_HORSES.map((h, index) => {
              const isSelected = h.id === selectedHorseId;
              const displayName = currentRaceNames[index] || h.name;
              return (
                <TouchableOpacity
                  key={`selector-${h.id}`}
                  disabled={isInteractionDisabled}
                  onPress={() => setSelectedHorseId(h.id)}
                  style={[
                    styles.horseSelectionPill,
                    { backgroundColor: h.color, opacity: isSelected ? 1 : 0.4 },
                    isSelected && styles.activePillGlow
                  ]}
                >
                  <Text style={styles.pillText} numberOfLines={1} adjustsFontSizeToFit>
                    {displayName.split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Real-time Statistics Dashboard Ledger */}
          <View style={styles.dashboardRow}>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>VAULT FUNDS</Text>
              <Text style={[styles.statValue, { color: "#00ffcc" }]}>${credits}</Text>
            </View>
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>WAGER STAKE</Text>
              <Text style={[styles.statValue, { color: "#ffcc00" }]}>${bet}</Text>
            </View>
            
            <View style={styles.dashboardStat}>
              <Text style={styles.statLabel}>PREV WINNER</Text>
              <Text 
                style={[
                  styles.statValue, 
                  { color: previousWinner ? previousWinner.color : "#666", fontSize: previousWinner ? 9 : 14 }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {previousWinner ? previousWinner.name.toUpperCase() : "NONE"}
              </Text>
            </View>
          </View>
        </View>

        {/* Interactive Bottom Control Deck console */}
        <View style={styles.buttonConsoleDeck}>
          <TouchableOpacity 
            style={[styles.arcadeButton, styles.blueBtn, isInteractionDisabled && styles.disabledBtn]} 
            disabled={isInteractionDisabled} 
            onPress={() => changeBet(-5)}
          >
            <Text style={styles.btnText}>BET -5</Text>
          </TouchableOpacity>

          <View style={[styles.inputWrapper, isLockedPostRace && { borderColor: "#444" }]}>
            <TextInput
              style={styles.customBetInput}
              keyboardType="number-pad"
              editable={!isInteractionDisabled}
              value={bet === 0 ? "" : bet.toString()}
              onChangeText={handleCustomBetInput}
              maxLength={6}
              placeholder="0"
              placeholderTextColor="#555"
              selectTextOnFocus
            />
          </View>

          <TouchableOpacity 
            style={[styles.arcadeButton, styles.blueBtn, isInteractionDisabled && styles.disabledBtn]} 
            disabled={isInteractionDisabled} 
            onPress={() => changeBet(5)}
          >
            <Text style={styles.btnText}>BET +5</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.arcadeButton, 
              styles.spinBtn, 
              (credits < bet || bet === 0 || isInteractionDisabled) && styles.disabledBtn
            ]}
            disabled={isInteractionDisabled || bet === 0 || credits < bet}
            onPress={handleStartRace}
          >
            <Text style={styles.spinBtnText}>
              {isRacing ? "RACING" : isLockedPostRace ? "LOCKED" : "START"}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  
  headerContainer: { alignItems: "center", marginBottom: 15 },
  titleText: { fontSize: 36, fontWeight: "900", color: "#ff0055", letterSpacing: 4, textShadowColor: "#ff0055", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  subtitleText: { fontSize: 14, fontWeight: "bold", color: "#00ffff", letterSpacing: 6, textShadowColor: "#00ffff", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  titleUmamusume: { color: "#ff66b2", textShadowColor: "#ff66b2", textShadowRadius: 15 }, 

  machineCabinet: { backgroundColor: "#1e1e24", padding: 14, borderRadius: 23, borderWidth: 6, borderColor: "#4d4d5a", shadowColor: "#000", shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.6, shadowRadius: 15, elevation: 12, width: 330 },
  ledDisplay: { backgroundColor: "#050505", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, borderWidth: 2, borderColor: "#333", marginBottom: 12, alignItems: "center", justifyContent: "center", minHeight: 44 },
  ledText: { color: "#ff3333", fontWeight: "bold", fontSize: 11, letterSpacing: 0.5, textAlign: "center", lineHeight: 14 },

  trackContainer: { position: "relative" },
  stadiumWindow: { backgroundColor: "#0b0c10", borderRadius: 14, borderWidth: 3, borderColor: "#ffcc00", paddingVertical: 10, overflow: "hidden" },
  trackLane: { flexDirection: "row", height: 38, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#1f2833" },
  laneLabelPlate: { width: 25, alignItems: "center", justifyContent: "center", backgroundColor: "#050505", height: "100%" },
  laneLabelNumber: { fontSize: 12, fontWeight: "900" },
  runningField: { flex: 1, position: "relative", height: "100%", justifyContent: "center" },
  horseRunnerEntity: { position: "absolute", left: 0, width: 22, height: 16, borderRadius: 4, shadowRadius: 3, shadowOpacity: 0.5, alignItems: "center", justifyContent: "center" },
  crownDecoration: { position: "absolute", top: -15, fontSize: 11, textShadowColor: "#000", textShadowRadius: 3, width: 16, textAlign: "center" },
  finishLineMarker: { position: "absolute", left: FINISH_LINE + 10, top: 0, bottom: 0, width: 3, backgroundColor: "#ff3366", opacity: 0.6 },

  podiumOverlayPanel: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(5, 6, 10, 0.96)", borderRadius: 14, borderWidth: 3, borderColor: "#ffcc00", justifyContent: "center", alignItems: "center", zIndex: 99 },
  podiumSpriteContainer: { alignItems: "center", justifyContent: "center", marginBottom: 6, position: "relative" },
  giantCrown: { fontSize: 32, marginBottom: -2, textShadowColor: "#ffcc00", textShadowRadius: 6, zIndex: 100 },
  podiumHorseSprite: { width: 44, height: 32, borderRadius: 6, borderWidth: 2, borderColor: "#fff", shadowRadius: 6, shadowOpacity: 0.8, shadowColor: "#fff" },
  podiumWinnerText: { fontSize: 18, fontWeight: "900", letterSpacing: 1, textShadowColor: "#000", textShadowRadius: 4, textAlign: "center", marginTop: 4 },
  podiumSubTitle: { color: "#888", fontSize: 8, fontWeight: "bold", marginTop: 2, letterSpacing: 2 },
  statusBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  consoleSectionTitle: { color: "#888", fontSize: 9, fontWeight: "bold", textAlign: "center", marginTop: 14, marginBottom: 6, letterSpacing: 1 },
  horseSelectRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  horseSelectionPill: { 
    flex: 1, 
    marginHorizontal: 2, 
    height: 32, 
    borderRadius: 8, 
    justifyContent: "center", 
    alignItems: "center", 
    paddingHorizontal: 2,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#4d4d5a'
  },
  activePillGlow: { 
    borderColor: "#ffffff75"
  },
  pillText: { color: "#fff", fontSize: 9, fontWeight: "900", textAlign: "center" },

  dashboardRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, backgroundColor: "#111", padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "#444" },
  dashboardStat: { alignItems: "center", flex: 1, justifyContent: "center" },
  statLabel: { fontSize: 8, fontWeight: "bold", color: "#888", marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: "900", textAlign: "center" },

  buttonConsoleDeck: { flexDirection: "row", backgroundColor: "#2f3640", padding: 12, borderRadius: 16, marginTop: 20, borderWidth: 3, borderColor: "#718093", width: 330, justifyContent: "space-between", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 8 },
  arcadeButton: { paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10, justifyContent: "center", alignItems: "center", minWidth: 65, borderBottomWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3 },
  blueBtn: { backgroundColor: "#00a8ff", borderBottomColor: "#0088cc" },
  spinBtn: { backgroundColor: "#4cd137", borderBottomColor: "#44bd32", minWidth: 80 },
  disabledBtn: { backgroundColor: "#718093", borderBottomColor: "#2f3640", opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  spinBtnText: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },

  inputWrapper: { width: 70, height: 42, backgroundColor: "#000", borderRadius: 8, borderWidth: 2, borderColor: "#ffcc00", justifyContent: "center", alignItems: "center" },
  customBetInput: { width: "100%", height: "100%", color: "#ffcc00", fontSize: 16, fontWeight: "900", textAlign: "center", padding: 0 },
});