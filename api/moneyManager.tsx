import AsyncStorage from "@react-native-async-storage/async-storage";

const CREDITS_KEY = "@user_total_credits";
const DEFAULT_CREDITS = 10000;

export const MoneyManager = {
  getCredits: async(): Promise<number> => {
    try {
      const money = await AsyncStorage.getItem(CREDITS_KEY);
      if(money == null) {
        await AsyncStorage.setItem(CREDITS_KEY, DEFAULT_CREDITS.toString());
        return DEFAULT_CREDITS;
      }

      return parseInt(money);

    } catch(ex) {
      console.error("error code ", ex);
      return DEFAULT_CREDITS;
    }
  },

  saveCredits: async(amount: number): Promise<void> => {
    try {
      await AsyncStorage.setItem(CREDITS_KEY, amount.toString());
    } catch(ex) {
      console.error("error code ", ex);
    }
  }
};