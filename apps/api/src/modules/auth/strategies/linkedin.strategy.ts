import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-linkedin-oauth2";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, "linkedin") {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.getOrThrow("LINKEDIN_CLIENT_ID"),
      clientSecret: configService.getOrThrow("LINKEDIN_CLIENT_SECRET"),
      callbackURL: `${configService.get("API_URL")}/api/v1/auth/linkedin/callback`,
      scope: ["openid", "profile", "email"],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return {
      provider: "linkedin",
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? "",
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
      accessToken,
    };
  }
}
