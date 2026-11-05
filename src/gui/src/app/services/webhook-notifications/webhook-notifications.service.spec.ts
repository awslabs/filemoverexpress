import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { firstValueFrom } from 'rxjs';
import { WebhookNotificationsService } from './webhook-notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { StreamingClientError } from '@app/classes';
import { NotificationDestinationSchema, NotificationPreset } from '@gen/es/fme/v1/notifications_pb';

// A unary RPC on the real CallbackClient is `method(request, callback)`. A real transport
// delivers the callback asynchronously, so defer with queueMicrotask: a synchronous
// callback would complete the Subject before firstValueFrom() subscribes and throw
// EmptyError. This mirrors the fme-client.service.spec pattern.
function makeClient() {
    return {
        setNotificationDestination: vi.fn((_req: unknown, cb: (e: unknown, r: unknown) => void) => {
            queueMicrotask(() => cb(undefined, {success: true, message: '', destination: _req}));
        }),
        deleteNotificationDestination: vi.fn((_req: unknown, cb: (e: unknown, r: unknown) => void) => {
            queueMicrotask(() => cb(undefined, {success: true, message: ''}));
        }),
        sendTestNotification: vi.fn((_req: unknown, cb: (e: unknown, r: unknown) => void) => {
            queueMicrotask(() => cb(undefined, {success: true, message: ''}));
        }),
    };
}

describe('WebhookNotificationsService', () => {
    describe('with a connected client', () => {
        let service: WebhookNotificationsService;
        let client: ReturnType<typeof makeClient>;

        beforeEach(() => {
            client = makeClient();
            TestBed.configureTestingModule({
                providers: [
                    WebhookNotificationsService, {provide: FmeClientService, useValue: {callbackClient: client}},
                ],
            });
            service = TestBed.inject(WebhookNotificationsService);
        });

        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        it('setDestination forwards the destination + url and resolves the response', async () => {
            const dest = create(NotificationDestinationSchema);
            dest.name = 'Team channel';
            dest.preset = NotificationPreset.SLACK;
            const res = await firstValueFrom(service.setDestination(dest, 'https://hooks.example/abc'));
            expect(res.success).toBe(true);
            const req = client.setNotificationDestination.mock.calls[0][0] as { destination: unknown; url: string };
            expect(req.destination).toBe(dest);
            expect(req.url).toBe('https://hooks.example/abc');
        });

        it('setDestination propagates RPC errors', async () => {
            client.setNotificationDestination.mockImplementationOnce((_req: unknown, cb: (e: unknown, r: unknown) => void) => {
                queueMicrotask(() => cb(new Error('boom'), undefined));
            });
            const dest = create(NotificationDestinationSchema);
            await expect(firstValueFrom(service.setDestination(dest, 'https://x'))).rejects.toThrow('boom');
        });

        it('deleteDestination forwards the name', async () => {
            const res = await firstValueFrom(service.deleteDestination('Team channel'));
            expect(res.success).toBe(true);
            const req = client.deleteNotificationDestination.mock.calls[0][0] as { name: string };
            expect(req.name).toBe('Team channel');
        });

        it('sendTest forwards the name', async () => {
            const res = await firstValueFrom(service.sendTest('Team channel'));
            expect(res.success).toBe(true);
            const req = client.sendTestNotification.mock.calls[0][0] as { name: string };
            expect(req.name).toBe('Team channel');
        });
    });

    describe('with no active connection', () => {
        let service: WebhookNotificationsService;

        beforeEach(() => {
            TestBed.configureTestingModule({
                providers: [
                    WebhookNotificationsService, {provide: FmeClientService, useValue: {callbackClient: null}},
                ],
            });
            service = TestBed.inject(WebhookNotificationsService);
        });

        it('setDestination errors with a StreamingClientError', async () => {
            const dest = create(NotificationDestinationSchema);
            await expect(firstValueFrom(service.setDestination(dest, 'https://x'))).rejects.toBeInstanceOf(StreamingClientError);
        });

        it('deleteDestination errors with a StreamingClientError', async () => {
            await expect(firstValueFrom(service.deleteDestination('x'))).rejects.toBeInstanceOf(StreamingClientError);
        });

        it('sendTest errors with a StreamingClientError', async () => {
            await expect(firstValueFrom(service.sendTest('x'))).rejects.toBeInstanceOf(StreamingClientError);
        });
    });
});
