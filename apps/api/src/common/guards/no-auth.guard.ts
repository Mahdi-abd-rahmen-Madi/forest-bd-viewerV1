import { Injectable, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class NoAuthGuard {
    canActivate(context: ExecutionContext): boolean {
        // Always allow access - no authentication required
        const ctx = GqlExecutionContext.create(context);
        const request = ctx.getContext().req;
        
        // Set a mock user for development
        request.user = {
            sub: '00000000-0000-0000-0000-000000000000',
            id: '00000000-0000-0000-0000-000000000000',
            email: 'dev@example.com',
            firstName: 'Dev',
            lastName: 'User',
        };
        
        return true;
    }
}
