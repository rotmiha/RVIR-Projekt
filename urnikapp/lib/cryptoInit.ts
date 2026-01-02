import bcrypt from "bcryptjs";
import * as Crypto from "expo-crypto";

// bcryptjs rabi random bytes za salt
bcrypt.setRandomFallback((len: number) => {
  const bytes = Crypto.getRandomBytes(len);
  // bcryptjs pričakuje navaden number[] (ne Uint8Array)
  return Array.from(bytes);
});
