import { Button, Text } from "@react-navigation/elements";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, StyleSheet, TouchableOpacity, View } from "react-native";
// FIX 1: Import useIsFocused to catch navigation visibility changes
import { useIsFocused } from "@react-navigation/native";
import { MoneyManager } from "../../api/moneyManager";

const heads = require("../../assets/images/coin/coin-heads.png");
const tails = require("../../assets/images/coin/coin-tails.png");
const audio = require("../../assets/audio/base/placebet.mp3");

export default function CoinFlip() {
    const isFocused = useIsFocused(); // Hook tracks if screen is visible
    const [face, setFace] = useState(heads);
    const [flipping, setFlipping] = useState(false);
    
    // Game Ecosystem States
    const [credits, setCredits] = useState<number>(0);
    const [bet, setBet] = useState<number>(10);
    const [chosenSide, setChosenSide] = useState<"HEADS" | "TAILS">("HEADS");

    const spinAnimation = useRef(new Animated.Value(0)).current;
    const hasSwapped = useRef(false);
    const nextFace = useRef(heads);
    const audioPlayer = useAudioPlayer(audio);

    // FIX 2: Re-run this effect every single time the screen becomes focused
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
            if(value >= 0.5 && !hasSwapped.current) {
                setFace(nextFace.current);
                hasSwapped.current = true;
            }
        });

        return () => spinAnimation.removeListener(id);
    }, [spinAnimation]);

    const changeBet = (amount: number) => {
        if (flipping) return;
        const targetBet = bet + amount;
        if (targetBet >= 0 && targetBet <= credits) {
            setBet(targetBet);
        }
    };

    const flip = async () => {
        if (flipping) return;

        // Fetch fresh storage context immediately before validating wagers 
        // to prevent clicking with stale UI states
        const freshCredits = await MoneyManager.getCredits();
        if (freshCredits < bet || bet === 0) {
            setCredits(freshCredits); // Sync UI quickly if out of bounds
            return;
        }

        // Take away bet amount instantly
        const balanceAfterBet = freshCredits - bet;
        setCredits(balanceAfterBet);
        await MoneyManager.saveCredits(balanceAfterBet);

        audioPlayer.seekTo(0.2);
        audioPlayer.volume = 0.2;
        audioPlayer.play();

        setFlipping(true);
        hasSwapped.current = false;
        
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
                finalWalletAmount += (bet * 2);
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

    return (
        <ImageBackground source={require("../../assets/images/background/background.jpg")} style={styles.background} resizeMode="cover">
            <View style={styles.container}>
                
                <Text style={styles.text}><Text>${credits}</Text></Text>
                
                <TouchableOpacity onPress={flip} disabled={flipping || credits < bet || bet === 0} style={styles.coinButton}>
                    <Animated.Image source={face} resizeMode="contain" style={[styles.image, { transform: [{ rotateY: spinRotate }] }, { opacity }]}/>
                </TouchableOpacity>

                <View style={styles.choiceRow}>
                    <TouchableOpacity 
                        style={[styles.choiceBtn, chosenSide === "HEADS" && styles.activeChoice]} 
                        onPress={() => !flipping && setChosenSide("HEADS")}
                    >
                        <Text style={styles.choiceText}>HEADS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.choiceBtn, chosenSide === "TAILS" && styles.activeChoice]} 
                        onPress={() => !flipping && setChosenSide("TAILS")}
                    >
                        <Text style={styles.choiceText}>TAILS</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.betPanel}>
                    <Button style={styles.betButtons} onPress={() => changeBet(-5)}>-</Button>
                    <Text style={styles.bet}>{bet}</Text>
                    <Button style={styles.betButtons} onPress={() => changeBet(5)}>+</Button>
                </View>

            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  coinButton: { borderRadius: 120, overflow: "hidden", paddingBottom: 20 },
  image: { width: 220, height: 220, backfaceVisibility: "hidden" },
  background: { flex: 1 },
  text: { fontSize: 34, fontWeight: "bold", color: "#fff", paddingBottom: 24 },
  choiceRow: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  choiceBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, borderWidth: 1.5, borderColor: 'transparent' },
  activeChoice: { borderColor: '#ffcc00', backgroundColor: 'rgba(255,215,0,0.25)' },
  choiceText: { color: '#fff', fontWeight: 'bold' },
  betPanel: { flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 12 },
  betButtons: { borderRadius: 6 },
  bet: { fontSize: 32, color: '#ffcc00', fontWeight: '900', minWidth: 50, textAlign: 'center' }
});