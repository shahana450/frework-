import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        freelancerProfile: {
          include: { skills: { include: { skill: true } }, languages: true },
        },
        clientProfile: true,
        subscription: true,
        wallet: true,
      },
    });

    if (!user) throw new NotFoundException("User not found");
    const { passwordHash, twoFactorSecret, ...safe } = user as any;
    return safe;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async updateProfile(userId: string, data: Prisma.UserUpdateInput) {
    const { passwordHash, twoFactorSecret, ...updateData } = data as any;
    return this.prisma.user.update({ where: { id: userId }, data: updateData });
  }

  async updateOnlineStatus(userId: string, isOnline: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isOnline, lastSeenAt: new Date() },
    });
  }

  async getPublicProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        coverImage: true,
        bio: true,
        role: true,
        verificationStatus: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
        freelancerProfile: {
          include: {
            skills: { include: { skill: { include: { category: true } } } },
            portfolio: true,
            education: true,
            experience: true,
            certifications: true,
            languages: true,
          },
        },
        reviewsReceived: {
          where: { isPublic: true },
          include: {
            reviewer: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async searchUsers(query: string, role?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status: "ACTIVE",
      ...(role && { role: role as any }),
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { username: { contains: query, mode: "insensitive" } },
        { bio: { contains: query, mode: "insensitive" } },
      ],
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, name: true, username: true, avatar: true,
          bio: true, role: true, verificationStatus: true, isOnline: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
