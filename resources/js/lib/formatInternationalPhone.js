/** E.164 max significant digits (excluding leading +). */
const MAX_DIGITS = 15;

/**
 * Formats the national (10-digit) part as (AAA) EEE-NNNN.
 * @param {string} national - exactly 10 digits
 */
function formatNationalTen(national) {
    const a = national.slice(0, 3);
    const b = national.slice(3, 6);
    const c = national.slice(6, 10);
    return `(${a}) ${b}-${c}`;
}

/**
 * International phone: leading +, country code = all digits before the last 10,
 * national 10 digits shown as +1(123) 123-1234 (no space between +CC and opening paren).
 * While still at 10 digits or fewer (no separate CC yet), shows +{digits}.
 */
export function formatInternationalPhoneInput(input) {
    if (input == null || input === '') {
        return '';
    }

    const digits = String(input).replace(/\D/g, '').slice(0, MAX_DIGITS);
    if (digits.length === 0) {
        return '';
    }

    if (digits.length <= 10) {
        return `+${digits}`;
    }

    const national = digits.slice(-10);
    const countryCode = digits.slice(0, -10);
    return `+${countryCode}${formatNationalTen(national)}`;
}

/**
 * True when there is a non-empty country code (at least one digit before the national part)
 * and exactly 10 national digits (11–15 total digits).
 */
export function isInternationalPhoneComplete(formatted) {
    if (formatted == null || formatted === '') {
        return false;
    }
    const digits = String(formatted).replace(/\D/g, '');
    if (digits.length < 11 || digits.length > MAX_DIGITS) {
        return false;
    }
    const national = digits.slice(-10);
    return national.length === 10 && /^\d{10}$/.test(national);
}
