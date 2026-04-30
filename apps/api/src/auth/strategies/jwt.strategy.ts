import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@forest/database';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get('JWT_SECRET')!,
        });
    }

    async validate(payload: any): Promise<User> {
        // Development mode bypass for mock authentication
        if (process.env.NODE_ENV === 'development' && payload.sub === 'dev-user') {
            // Return a mock user for development
            return {
                id: 'dev-user',
                email: 'dev@example.com',
                firstName: 'Dev',
                lastName: 'User',
                createdAt: new Date(),
                updatedAt: new Date(),
            } as User;
        }

        const user = await this.userRepository.findOne({ where: { id: payload.sub } });
        if (!user) {
            throw new UnauthorizedException();
        }
        return user;
    }
}