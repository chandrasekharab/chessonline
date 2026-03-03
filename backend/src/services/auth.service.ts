import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { env } from '../config/env';
import { AuthResponse, JwtPayload } from '../types';

const userRepo = new UserRepository();
const SALT_ROUNDS = 12;

export class AuthService {
  async register(email: string, password: string): Promise<AuthResponse> {
    const existing = await userRepo.findByEmail(email);
    if (existing) {
      throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userRepo.create(email, passwordHash);

    const token = this.signToken({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email } };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    const token = this.signToken({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email } };
  }

  private signToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  }
}

export const authService = new AuthService();
