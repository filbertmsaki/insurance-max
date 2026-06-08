import * as argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
};

export const hashPassword = async (password: string): Promise<string> => {
  return argon2.hash(password, ARGON2_OPTIONS);
};

export const comparePasswords = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

export const hashToken = async (token: string): Promise<string> => {
  return argon2.hash(token, { ...ARGON2_OPTIONS, memoryCost: 2 ** 14 });
};

export const verifyToken = async (
  token: string,
  hash: string,
): Promise<boolean> => {
  try {
    return await argon2.verify(hash, token);
  } catch {
    return false;
  }
};
