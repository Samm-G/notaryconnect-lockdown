import type { EventContext } from '@cloudflare/workers-types';
import type { Env } from '../../../worker-configuration';
import { serializeSessionCookie } from '../../utils/cookies';

export const onRequestPost = async (
    _context: EventContext<Env, any, Record<string, unknown>>
) => {
    // Clear cookie immediately by setting Max-Age=0
    const clearCookieHeader = serializeSessionCookie('', 0);

    return new Response(
        JSON.stringify({
            success: true,
            message: 'Signed out successfully. Session cookie destroyed.',
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': clearCookieHeader,
            },
        }
    );
};