declare const locationInput: HTMLInputElement;
declare const vibeInput: HTMLInputElement;
declare const searchButton: HTMLButtonElement;
declare const savedPlacesBtn: HTMLButtonElement;
declare const resultsList: HTMLUListElement;
declare const validationError: HTMLParagraphElement;
declare const logoutBtn: HTMLButtonElement;
declare const token: string | null;
declare function authenticatedFetch(url: string, options?: RequestInit): Promise<Response>;
declare const savedPlaceIds: Set<number>;
declare let showingSavedPlaces: boolean;
declare let userFeedback: Map<number, boolean>;
declare const viewedPlaceIds: Set<number>;
declare function refreshSavedPlaceIds(): Promise<any>;
declare function renderPlaces(places: any[]): void;
declare function validateInputs(): boolean;
//# sourceMappingURL=app.d.ts.map