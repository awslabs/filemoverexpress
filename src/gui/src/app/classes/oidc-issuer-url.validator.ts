import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { WailsService } from '@services/wails/wails.service';

/**
 * Debounce delay in milliseconds before the validator fires the request.
 * Prevents hitting the IdP on every keystroke.
 */
const DEBOUNCE_MS = 600;

/**
 * Creates an async validator that probes the OIDC discovery endpoint
 * (`/.well-known/openid-configuration`) for the given Issuer URL by
 * delegating the fetch to the native Go layer via Wails bindings
 * (avoiding browser CORS restrictions).
 *
 * Validation passes when the endpoint returns a JSON document containing
 * the required OIDC fields. Validation fails with descriptive error keys
 * when the URL is malformed, unreachable, or returns an invalid document.
 *
 * Error keys produced:
 * - `invalidUrl`        – value is not a valid absolute HTTPS URL
 * - `httpsRequired`     – URL uses http:// instead of https://
 * - `oidcUnreachable`   – network error or timeout fetching the discovery doc
 * - `oidcInvalidDoc`    – response is not valid JSON or is missing required fields
 */
export function oidcIssuerUrlValidator(wails: WailsService): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
        const value: string = (control.value ?? '').trim();

        // Skip validation if empty (let `Validators.required` handle that)
        if (!value) {
            return of(null);
        }

        // Quick synchronous check: reject non-URL values immediately
        if (!isValidUrl(value)) {
            return of({invalidUrl: true});
        }

        // Reject plain HTTP — OIDC issuers must use HTTPS
        if (!isHttps(value)) {
            return of({httpsRequired: true});
        }

        // Debounce then delegate to the native Go layer
        return timer(DEBOUNCE_MS).pipe(
            switchMap(() => wails.validateOIDCIssuer(value)),
            map((errorKey) => {
                if (!errorKey) {
                    return null;
                }
                return {[errorKey]: true};
            }),
        );
    };
}

/**
 * Returns true when `value` is a syntactically valid URL with http or https scheme.
 */
function isValidUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

/**
 * Returns true when `value` uses the https:// scheme.
 */
function isHttps(value: string): boolean {
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}
