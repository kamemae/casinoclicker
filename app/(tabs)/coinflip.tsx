import { useIsFocused } from "@react-navigation/native";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MoneyManager } from "../../api/moneyManager";

const heads = require("../../assets/images/coin/coin-heads.png");
const tails = require("../../assets/images/coin/coin-tails.png");
const audio = require("../../assets/audio/base/placebet.mp3");

export default function CoinFlip() {
  const isFocused = useIsFocused();
  const [face, setFace] = useState(heads);
  const [flipping, setFlipping] = useState(false);
  
  // Game Ecosystem States
  const [credits, setCredits] = useState<number>(0);
  const [bet, setBet] = useState<number>(10);
  const [chosenSide, setChosenSide] = useState<"HEADS" | "TAILS">("HEADS");
  const [message, setMessage] = useState("PLACE YOUR BET & FLIP");

  const spinAnimation = useRef(new Animated.Value(0)).current;
  const hasSwapped = useRef(false);
  const nextFace = useRef(heads);
  const audioPlayer = useAudioPlayer(audio);

  // Read current bet securely via a ref to completely stop timeout closures from using stale values
  const currentBetRef = useRef(bet);
  useEffect(() => {
    currentBetRef.current = bet;
  }, [bet]);

  // Re-run this effect every single time the screen becomes focused
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
    const id = spinAnimation.addListener(({ value }) => {
      if (value >= 0.5 && !hasSwapped.current) {
        setFace(nextFace.current);
        hasSwapped.current = true;
      }
    });

    return () => spinAnimation.removeListener(id);
  }, [spinAnimation]);

  const changeBet = (amount: number) => {
    if (flipping) return;
    const targetBet = bet + amount;
    if (targetBet > 0 && targetBet <= credits) {
      setBet(targetBet);
    }
  };

  // NEW: Handles direct numeric typing inputs smoothly
  const handleCustomBetInput = (text: string) => {
    if (flipping) return;
    
    // Clean string input to absolute digits only
    const sanitizedText = text.replace(/[^0-9]/g, "");
    if (sanitizedText === "") {
      setBet(0);
      return;
    }

    const parsedBet = parseInt(sanitizedText, 10);
    if (parsedBet <= credits) {
      setBet(parsedBet);
    } else {
      setBet(credits); // Max out at current total capacity if they try to over-wager
    }
  };

  const flip = async () => {
    if (flipping) return;

    // Fetch fresh storage context immediately before validating wagers 
    const freshCredits = await MoneyManager.getCredits();
    const activeBet = currentBetRef.current;

    if (activeBet <= 0) {
      setMessage("🚫 CHOOSE A VALID WAGER! 🚫");
      return;
    }

    if (freshCredits < activeBet) {
      setMessage("🚫 INSUFFICIENT CREDITS! 🚫");
      setCredits(freshCredits); // Sync UI quickly if out of bounds
      return;
    }

    // Take away bet amount instantly
    const balanceAfterBet = freshCredits - activeBet;
    setCredits(balanceAfterBet);
    await MoneyManager.saveCredits(balanceAfterBet);

    if (audioPlayer) {
      audioPlayer.seekTo(0.2);
      audioPlayer.volume = 0.4;
      audioPlayer.play();
    }

    setFlipping(true);
    hasSwapped.current = false;
    setMessage("⚡ COIN IN THE AIR... ⚡");
    
    const isHeads = Math.random() > 0.5;
    nextFace.current = isHeads ? heads : tails;

    Animated.sequence([
      Animated.timing(spinAnimation, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(spinAnimation, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      setFlipping(false);
      
      const landedSide = isHeads ? "HEADS" : "TAILS";
      let finalWalletAmount = balanceAfterBet;

      if (chosenSide === landedSide) {
        finalWalletAmount += (activeBet * 2);
        setMessage("🏆 🎉 YOU WIN! 🎉 🏆");
      } else {
        setMessage("TRY AGAIN!");
      }

      setCredits(finalWalletAmount);
      await MoneyManager.saveCredits(finalWalletAmount);
    });
  };

  const spinRotate = spinAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "720deg"],
  });

  const opacity = spinAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.4, 1],
  });

  const disableButtons = flipping || credits < bet;

  return (
    <ImageBackground source={require("../../assets/images/background/background.jpg")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        
        {/* Header Section Matching Slot Machine */}
        <View style={styles.headerContainer}>
          <Text style={styles.titleText}>2 PLN FLIP</Text>
          <Text style={styles.subtitleText}>LUCKY COIN FLIP</Text>
        </View>

        {/* Central Machine Cabinet */}
        <View style={styles.machineCabinet}>
          
          {/* LED Banner Display */}
          <View style={styles.ledDisplay}>
            <Text style={styles.ledText}>{message}</Text>
          </View>
          
          {/* Main Visual Display Window */}
          <View style={styles.glassWindow}>
            <TouchableOpacity onPress={flip} disabled={disableButtons || bet === 0} style={styles.coinButton} activeOpacity={0.8}>
              <Animated.Image source={face} resizeMode="contain" style={[styles.image, { transform: [{ rotateY: spinRotate }] }, { opacity }]}/>
            </TouchableOpacity>
          </View>

          {/* Interactive Binary Choice Row */}
          <View style={styles.choiceRow}>
            <TouchableOpacity 
              style={[styles.choiceBtn, chosenSide === "HEADS" && styles.activeChoiceH]} 
              onPress={() => !flipping && setChosenSide("HEADS")}
              disabled={flipping}
            >
              <Text style={[styles.choiceText, chosenSide === "HEADS" && { color: '#fff' }]}>HEADS</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.choiceBtn, chosenSide === "TAILS" && styles.activeChoiceT]} 
              onPress={() => !flipping && setChosenSide("TAILS")}
              disabled={flipping}
            >
              <Text style={[styles.choiceText, chosenSide === "TAILS" && { color: '#fff' }]}>TAILS</Text>
            </TouchableOpacity>
          </View>

          {/* Core Stat Dashboard Panel */}
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
              <Text style={styles.statLabel}>PICK</Text>
              <Text style={[styles.statValue, { color: '#ff0055' }]}>{chosenSide}</Text>
            </View>
          </View>
        </View>

        {/* Unified Bottom Console Control Deck */}
        <View style={styles.buttonConsoleDeck}>
          <TouchableOpacity style={[styles.arcadeButton, styles.blueBtn, flipping && styles.disabledBtn]} onPress={() => changeBet(-5)} disabled={flipping}>
            <Text style={styles.btnText}>BET -5</Text>
          </TouchableOpacity>

          {/* NEW: Custom Bet Amount Text Input Box */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.customBetInput, flipping && styles.disabledInput]}
              keyboardType="number-pad"
              value={bet === 0 ? "" : bet.toString()}
              onChangeText={handleCustomBetInput}
              maxLength={6}
              editable={!flipping}
              placeholder="0"
              placeholderTextColor="#555"
              selectTextOnFocus
            />
          </View>

          <TouchableOpacity style={[styles.arcadeButton, styles.blueBtn, flipping && styles.disabledBtn]} onPress={() => changeBet(5)} disabled={flipping}>
            <Text style={styles.btnText}>BET +5</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.arcadeButton, styles.spinBtn, disableButtons && styles.disabledBtn]} onPress={flip} disabled={disableButtons || bet === 0}>
            <Text style={styles.spinBtnText}>FLIP</Text>
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
  
  machineCabinet: { backgroundColor: "#1e1e24", padding: 16, borderRadius: 23, borderWidth: 6, borderColor: "#4d4d5a", shadowColor: "#000", shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.6, shadowRadius: 15, elevation: 12, width: 320 },
  ledDisplay: { backgroundColor: "#050505", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, borderWidth: 2, borderColor: "#333", marginBottom: 15, alignItems: 'center' },
  ledText: { color: '#ff3333', fontWeight: 'bold', fontSize: 14, letterSpacing: 1, textAlign: 'center' },
  
  glassWindow: { backgroundColor: "#111", padding: 16, borderRadius: 14, borderWidth: 3, borderColor: "#ffcc00", alignItems: 'center', justifyContent: 'center', height: 200 },
  coinButton: { alignItems: 'center', justifyContent: 'center' },
  image: { width: 150, height: 150, backfaceVisibility: "hidden" },
  
  choiceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 15 },
  choiceBtn: { flex: 1, paddingVertical: 10, backgroundColor: '#2f3640', borderRadius: 8, borderWidth: 2, borderColor: '#718093', alignItems: 'center', borderBottomWidth: 4 },
  choiceText: { color: '#888', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
  activeChoiceH: { borderColor: '#00a8ff', backgroundColor: 'rgba(0, 168, 255, 0.2)' },
  activeChoiceT: { borderColor: '#ff0055', backgroundColor: 'rgba(255, 0, 85, 0.2)' },
  
  dashboardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, backgroundColor: '#111', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#444' },
  dashboardStat: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 9, fontWeight: 'bold', color: '#888', marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: '900' },
  
  // MODIFIED: Adjusted console layout sizing to gracefully wedge the custom input block inside 
  buttonConsoleDeck: { flexDirection: 'row', backgroundColor: '#2f3640', padding: 12, borderRadius: 16, marginTop: 25, borderWidth: 3, borderColor: '#718093', width: 340, justifyContent: 'space-between', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 8 },
  arcadeButton: { paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10, justifyContent: 'center', alignItems: 'center', minWidth: 65, borderBottomWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3 },
  blueBtn: { backgroundColor: '#00a8ff', borderBottomColor: '#0088cc' },
  spinBtn: { backgroundColor: '#4cd137', borderBottomColor: '#44bd32', minWidth: 80 },
  disabledBtn: { backgroundColor: '#718093', borderBottomColor: '#2f3640', opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  spinBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  // NEW: Sleek custom terminal styles for the text input box
  inputWrapper: { width: 70, height: 42, backgroundColor: '#000', borderRadius: 8, borderWidth: 2, borderColor: '#ffcc00', justifyContent: 'center', alignItems: 'center' },
  customBetInput: { width: '100%', height: '100%', color: '#ffcc00', fontSize: 16, fontWeight: '900', textAlign: 'center', padding: 0 },
  disabledInput: { color: '#555', opacity: 0.7 }
});