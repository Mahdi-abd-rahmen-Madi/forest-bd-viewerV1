import { Injectable, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GqlAuthGuard } from './gql-auth.guard';

@Injectable()
export class DevAuthGuard extends GqlAuthGuard {
    canActivate(context: ExecutionContext) {
        console.log('DevAuthGuard - NODE_ENV:', process.env.NODE_ENV);
        
        // In development mode, allow mock authentication
        if (process.env.NODE_ENV === 'development') {
            const ctx = GqlExecutionContext.create(context);
            const request = ctx.getContext().req;
            const authHeader = request.headers.authorization;
            console.log('DevAuthGuard - authHeader:', authHeader);
            
            // Check if it's the dev token
            if (authHeader === 'Bearer dev-token') {
                console.log('DevAuthGuard - Using dev token bypass');
                // Set a mock user on the request
                request.user = {
                    sub: 'dev-user',
                    id: 'dev-user',
                    email: 'dev@example.com',
                    firstName: 'Dev',
                    lastName: 'User',
                };
                return true;
            }
        }
        
        // Fall back to normal JWT authentication
        console.log('DevAuthGuard - Falling back to JWT auth');
        return super.canActivate(context);
    }
}
