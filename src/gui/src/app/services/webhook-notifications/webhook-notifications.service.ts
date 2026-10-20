import { inject, Injectable } from '@angular/core';
import { StreamingClientError, StreamingClientErrorType } from '@app/classes';
import { create } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import {
    DeleteNotificationDestinationRequestSchema,
    DeleteNotificationDestinationResponse,
    NotificationDestination,
    SendTestNotificationRequestSchema,
    SendTestNotificationResponse,
    SetNotificationDestinationRequestSchema,
    SetNotificationDestinationResponse,
} from '@gen/es/fme/v1/notifications_pb';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { Observable, Subject } from 'rxjs';

/**
 * Wraps the daemon's webhook-notification RPCs (set / delete / send-test) in the
 * same Subject/callback-to-Observable style FmeClientService uses.
 *
 * This is deliberately NOT the `notifications` service under services/notifications:
 * that one is the in-app toast/alert panel. This service manages the daemon-owned
 * webhook DESTINATIONS (Slack, Teams, Discord, ...).
 *
 * The webhook URL is write-only: it is sent only on SetNotificationDestinationRequest.url
 * and never read back. The daemon stores it encrypted and returns only has_url + a
 * non-sensitive url_hint. This service never displays or reads a stored URL.
 */
@Injectable({
    providedIn: 'root',
})
export class WebhookNotificationsService {
    private fmeClient = inject(FmeClientService);

    /**
     * Create or update a destination. Pass a non-empty `url` to store/replace the webhook
     * URL; pass an empty string on an edit to keep the stored URL unchanged.
     */
    setDestination(destination: NotificationDestination, url: string): Observable<SetNotificationDestinationResponse> {
        const sub = new Subject<SetNotificationDestinationResponse>();
        const client = this.fmeClient.callbackClient;
        if (!client) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        const req = create(SetNotificationDestinationRequestSchema);
        req.destination = destination;
        req.url = url;

        client.setNotificationDestination(
            req,
            (err: ConnectError | undefined, res: SetNotificationDestinationResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }
                sub.next(res);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    /** Delete a destination by name. */
    deleteDestination(name: string): Observable<DeleteNotificationDestinationResponse> {
        const sub = new Subject<DeleteNotificationDestinationResponse>();
        const client = this.fmeClient.callbackClient;
        if (!client) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        const req = create(DeleteNotificationDestinationRequestSchema);
        req.name = name;

        client.deleteNotificationDestination(
            req,
            (err: ConnectError | undefined, res: DeleteNotificationDestinationResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }
                sub.next(res);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    /** Ask the daemon to post a test message to the named destination. */
    sendTest(name: string): Observable<SendTestNotificationResponse> {
        const sub = new Subject<SendTestNotificationResponse>();
        const client = this.fmeClient.callbackClient;
        if (!client) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        const req = create(SendTestNotificationRequestSchema);
        req.name = name;

        client.sendTestNotification(
            req,
            (err: ConnectError | undefined, res: SendTestNotificationResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }
                sub.next(res);
                sub.complete();
            },
        );

        return sub.asObservable();
    }
}
