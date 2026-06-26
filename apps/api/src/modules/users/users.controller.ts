import { Controller, Get, Param, Query, UseGuards, Request, Patch, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

@ApiTags("Users")
@Controller({ path: "users", version: "1" })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  async getMe(@Request() req: any) {
    return this.usersService.findById(req.user.id);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update current user profile" })
  async updateMe(@Request() req: any, @Body() body: any) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @Get(":username")
  @ApiOperation({ summary: "Get public user profile" })
  async getPublicProfile(@Param("username") username: string) {
    return this.usersService.getPublicProfile(username);
  }

  @Get()
  @ApiOperation({ summary: "Search users" })
  async search(
    @Query("q") q = "",
    @Query("role") role?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.usersService.searchUsers(q, role, +page, +limit);
  }
}
