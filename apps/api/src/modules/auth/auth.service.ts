import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import { UsersService } from "../users/users.service";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UserRole } from "@prisma/client";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone ?? undefined }] },
    });

    if (existingUser) {
      throw new ConflictException(
        existingUser.email === dto.email
          ? "Email already registered"
          : "Phone number already registered"
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role ?? UserRole.CLIENT,
        phone: dto.phone,
        referredById: dto.referralCode
          ? await this.getUserIdByReferralCode(dto.referralCode)
          : null,
      },
    });

    // Send verification email (fire and forget)
    this.sendVerificationEmail(user.id, user.email).catch((err) =>
      this.logger.error("Failed to send verification email", err)
    );

    const tokens = await this.generateTokenPair(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      throw new UnauthorizedException("Account suspended. Contact support.");
    }

    if (user.twoFactorEnabled) {
      const pendingToken = this.jwtService.sign(
        { sub: user.id, twoFactorPending: true },
        { expiresIn: "5m" }
      );
      return { requiresTwoFactor: true, pendingToken };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeenAt: new Date() },
    });

    const tokens = await this.generateTokenPair(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow("JWT_REFRESH_SECRET"),
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException("User not found");

      const tokens = await this.generateTokenPair(user.id, user.email, user.role);
      return tokens;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  async logout(userId: string, sessionToken?: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeenAt: new Date() },
    });

    if (sessionToken) {
      await this.prisma.session.deleteMany({ where: { token: sessionToken } });
    }

    return { message: "Logged out successfully" };
  }

  async verifyEmail(token: string) {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwtService.verify(token) as typeof payload;
    } catch {
      throw new BadRequestException("Invalid or expired verification token");
    }

    if (payload.type !== "email_verification") {
      throw new BadRequestException("Invalid token type");
    }

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { emailVerified: new Date() },
    });

    return { message: "Email verified successfully" };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) return { message: "If that email exists, a reset link has been sent" };

    const resetToken = this.jwtService.sign(
      { sub: user.id, type: "password_reset" },
      { expiresIn: "1h" }
    );

    // TODO: Send email with reset link
    this.logger.log(`Password reset token for ${email}: ${resetToken}`);

    return { message: "If that email exists, a reset link has been sent" };
  }

  async resetPassword(token: string, newPassword: string) {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwtService.verify(token) as typeof payload;
    } catch {
      throw new BadRequestException("Invalid or expired reset token");
    }

    if (payload.type !== "password_reset") {
      throw new BadRequestException("Invalid token type");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });

    return { message: "Password reset successfully" };
  }

  async handleOAuthLogin(profile: {
    provider: string;
    providerId: string;
    email: string;
    name: string;
    avatar?: string;
    accessToken?: string;
  }) {
    let oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerId,
        },
      },
      include: { user: true },
    });

    if (oauthAccount) {
      const tokens = await this.generateTokenPair(
        oauthAccount.user.id,
        oauthAccount.user.email,
        oauthAccount.user.role
      );
      return { user: this.sanitizeUser(oauthAccount.user), ...tokens };
    }

    // Check if user exists with same email
    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          emailVerified: new Date(),
        },
      });
    }

    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerId,
        accessToken: profile.accessToken,
      },
    });

    const tokens = await this.generateTokenPair(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, status: "ACTIVE" },
    });
    return user;
  }

  private async generateTokenPair(userId: string, email: string, role: UserRole) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get("JWT_EXPIRES_IN", "15m"),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow("JWT_REFRESH_SECRET"),
        expiresIn: this.configService.get("JWT_REFRESH_EXPIRES_IN", "7d"),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async sendVerificationEmail(userId: string, email: string) {
    const token = this.jwtService.sign(
      { sub: userId, type: "email_verification" },
      { expiresIn: "24h" }
    );
    const url = `${this.configService.get("APP_URL")}/verify-email?token=${token}`;
    this.logger.log(`Verification URL for ${email}: ${url}`);
    // TODO: integrate email provider (Nodemailer/SendGrid)
  }

  private async getUserIdByReferralCode(code: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private sanitizeUser(user: any) {
    const { passwordHash, twoFactorSecret, ...safe } = user;
    return safe;
  }
}
