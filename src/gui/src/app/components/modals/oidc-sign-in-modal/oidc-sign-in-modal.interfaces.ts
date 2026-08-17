export interface OidcSignInModalData {
    profileName: string;
}

export type OidcSignInModalResult = 'authenticated' | 'edit' | null;
