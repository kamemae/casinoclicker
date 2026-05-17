import React, { useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
// Using your local AsyncStorage wrapper API
import { MoneyManager } from "../../api/moneyManager";

export default function Settings() {
  const [isResetting, setIsResetting] = useState(false);

  const handleResetCredits = () => {
    Alert.alert(
      "Reset Credits?",
      "Are you sure you want to restore your local balance back to $10,000?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Reset",
          style: "destructive",
          onPress: async () => {
            setIsResetting(true);
            try {
              // Directly writing to local device storage via your MoneyManager API
              await MoneyManager.saveCredits(10000);

              Alert.alert("Success 💰", "Local storage updated! Your balance is back to $10,000.");
            } catch (error) {
              console.error("Storage Reset Error:", error);
              Alert.alert("Storage Failure", "Could not access device storage to reset records.");
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ImageBackground 
      source={require("../../assets/images/background/background.jpg")} 
      style={styles.background} 
      resizeMode="cover"
    >
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.titleText}>SETTINGS</Text>
          <Text style={styles.subtitleText}>GAME ECOSYSTEM</Text>
        </View>

        <View style={styles.menuCabinet}>
          <Text style={styles.sectionLabel}>LOCAL STORAGE TERMINAL</Text>
          <Text style={styles.descriptionText}>
            This will overwrite your application's on-device cache records back to baseline allocations.
          </Text>

          <TouchableOpacity 
            style={[styles.arcadeButton, isResetting && styles.disabledBtn]} 
            onPress={handleResetCredits}
            disabled={isResetting}
          >
            {isResetting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>RESET STORAGE BALANCE TO $10K</Text>
            )}
          </TouchableOpacity>
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
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  titleText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#00ffff",
    letterSpacing: 4,
    textShadowColor: "#00ffff",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#ff0055",
    letterSpacing: 6,
    textShadowColor: "#ff0055",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  menuCabinet: {
    backgroundColor: "#1e1e24",
    padding: 24,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: "#4d4d5a",
    width: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#ffcc00",
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: "center",
  },
  descriptionText: {
    color: "#ccc",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
  },
  arcadeButton: {
    backgroundColor: "#e84118",
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 4,
    borderBottomColor: "#c23616",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
  },
  disabledBtn: {
    backgroundColor: "#718093",
    borderBottomColor: "#2f3640",
    opacity: 0.6,
  },
  btnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
});