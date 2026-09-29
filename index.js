/** Host half: an authenticated, exact POST endpoint for deliberate title regeneration. */
export const inject = ['connection', 'sessionController', 'sessionTitle'];

export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/local.auto-rename.refresh',
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      let input;
      try {
        input = await request.json();
      } catch {
        return Response.json({ error: 'Invalid JSON request.' }, { status: 400 });
      }
      const sessionId = input?.sessionId;
      if (typeof sessionId !== 'string' || !/^[\w-]{1,128}$/.test(sessionId)) {
        return Response.json({ error: 'Invalid session ID.' }, { status: 400 });
      }
      try {
        const resolved = await ctx.sessionController.resolveAgent(sessionId);
        if ('error' in resolved) {
          return Response.json({ error: resolved.error.message }, { status: 409 });
        }
        const session = resolved.agent.session;
        const previous = ctx.sessionTitle.get(session);
        const title = await ctx.sessionTitle.refresh(session, request.signal);
        if (title?.source.kind === 'fallback' && previous?.source.kind === 'user') {
          // Without a registered model provider, refresh replaces a pinned title with fallback.
          ctx.sessionTitle.rename(session, previous.title);
        }
        if (title === undefined) {
          return Response.json({ error: 'This session has no eligible message for a title.' }, { status: 422 });
        }
        if (title.source.kind !== 'provider' || title.eventSeq === previous?.eventSeq) {
          return Response.json({ error: 'No new model title was generated. Check the title provider and retry.' }, { status: 503 });
        }
        return Response.json({ title: title.title });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
      }
    },
  }), 'dsh-auto-rename: refresh endpoint');
}
