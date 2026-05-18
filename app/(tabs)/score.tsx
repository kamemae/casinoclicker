import React, { useEffect, useRef } from "react";
import { Animated, ImageBackground, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Continuous breathing glow animation for the arcade/neon theme
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Interpolate glow value for text shadows and colors dynamically
  const glowRadius = pulseAnim.interpolate({
    inputRange: [0.4, 1],
    outputRange: [6, 16],
  });

  return (
    <ImageBackground
      source={require("../../assets/images/background/background.jpg")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Main Cabinet Frame */}
        <View style={styles.cabinetWindow}>
          <View style={styles.headerContainer}>
            <Text style={styles.titleText}>ARCADE HUB</Text>
            <Animated.Text 
              style={[
                styles.neonText, 
                { 
                  textShadowRadius: glowRadius,
                  opacity: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.7, 1] }) 
                }
              ]}
            >
              COMING SOON
            </Animated.Text>
          </View>

          <View style={styles.divider} />

          {/* Body Content */}
          <View style={styles.infoBox}>
            <Text style={styles.emojiDisplay}>🕹️ ✨ 🃏</Text>
            <Text style={styles.descriptionText}>
              This function will be provided to you sometime around I don't know when, but it will be provided someday.
            </Text>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  cabinetWindow: {
    backgroundColor: "#1e1e24",
    padding: 30,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: "#4d4d5a",
    width: 320,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  titleText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#888",
    letterSpacing: 4,
    marginBottom: 5,
  },
  neonText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#ff0055",
    letterSpacing: 2,
    textShadowColor: "#ff0055",
    textShadowOffset: { width: 0, height: 0 },
  },
  divider: {
    width: "100%",
    height: 2,
    backgroundColor: "#333",
    marginVertical: 15,
  },
  infoBox: {
    alignItems: "center",
    paddingHorizontal: 10,
  },
  emojiDisplay: {
    fontSize: 32,
    marginBottom: 15,
    letterSpacing: 8,
  },
  descriptionText: {
    color: "#b2bec3",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
  },
  tickerFrame: {
    marginTop: 25,
    backgroundColor: "#050505",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
  },
  tickerText: {
    color: "#ffcc00",
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: "System",
    textAlign: "center",
    letterSpacing: 1,
  },
});