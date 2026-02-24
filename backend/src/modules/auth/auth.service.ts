import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

export interface AuthTokens {
  accessToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
}

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    const user = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
    });

    if (dto.firstName ?? dto.lastName) {
      await this.usersService.update(user.id, {
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
    }

    const tokens = this.generateTokens(user.id, user.email);

    const { password: _password, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, ...tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const tokens = this.generateTokens(user.id, user.email);

    const { password: _password, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, ...tokens };
  }

  private generateTokens(userId: string, email: string): AuthTokens {
    const payload = { sub: userId, email };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
