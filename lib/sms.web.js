// Webb-mock för expo-sms (native-only) — SMS är aldrig tillgängligt på webben.
export async function isAvailableAsync() {
  return false;
}

export async function sendSMSAsync() {
  return { result: 'cancelled' };
}
