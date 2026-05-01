import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserPolygon } from '@forest/database';
import { PolygonService } from './polygon.service';
import { SavePolygonInput } from './dto/save-polygon.input';
import { NoAuthGuard } from '../common/guards/no-auth.guard';

@Resolver(() => UserPolygon)
export class PolygonResolver {
  constructor(private readonly polygonService: PolygonService) {}

  @Mutation(() => UserPolygon)
  @UseGuards(NoAuthGuard)
  async savePolygon(
    @Args('input') input: SavePolygonInput,
    @Context() context: { req: { user: { sub: string } } },
  ): Promise<UserPolygon> {
    const userId = context.req.user.sub;
    return await this.polygonService.savePolygon(userId, input);
  }

  @Query(() => [UserPolygon])
  @UseGuards(NoAuthGuard)
  async myPolygons(
    @Context() context: { req: { user: { sub: string } } },
  ): Promise<UserPolygon[]> {
    const userId = context.req.user.sub;
    return await this.polygonService.getMyPolygons(userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(NoAuthGuard)
  async deletePolygon(
    @Args('polygonId') polygonId: string,
    @Context() context: { req: { user: { sub: string } } },
  ): Promise<boolean> {
    const userId = context.req.user.sub;
    return await this.polygonService.deletePolygon(userId, polygonId);
  }

  @Mutation(() => UserPolygon)
  @UseGuards(NoAuthGuard)
  async reanalyzePolygon(
    @Args('polygonId') polygonId: string,
    @Context() context: { req: { user: { sub: string } } },
  ): Promise<UserPolygon> {
    const userId = context.req.user.sub;
    return await this.polygonService.reanalyzePolygon(userId, polygonId);
  }

  @Mutation(() => Boolean)
  @UseGuards(NoAuthGuard)
  async deleteAllPolygons(
    @Context() context: { req: { user: { sub: string } } },
  ): Promise<boolean> {
    const userId = context.req.user.sub;
    return await this.polygonService.deleteAllPolygons(userId);
  }
}
