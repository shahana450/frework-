import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from "passport-github2";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.getOrThrow("GITHUB_CLIENT_ID"),
      clientSecret: configService.getOrThrow("GITHUB_CLIENT_SECRET"),
      callbackURL: `${configService.get("API_URL")}/api/v1/auth/github/callback`,
      scope: ["user:email"],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    return {
      provider: "github",
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? "",
      name: profile.displayName || profile.username,
      avatar: profile.photos?.[0]?.value,
      accessToken,
    };
  }
}
