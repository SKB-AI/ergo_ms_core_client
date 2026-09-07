export const DATE_MASK_MAX_LENGTH = 10
export const DATETIME_MASK_MAX_LENGTH = 16
export const SHORT_YEAR_DATE_MASK_MAX_LENGTH = 8
export const SHORT_YEAR_DATETIME_MASK_MAX_LENGTH = 16

function maxDigits(withTime, shortYear = false) {
    if (shortYear) return withTime ? 10 : 6
    return withTime ? 12 : 8
}

function maxLength(withTime, shortYear = false) {
    if (shortYear) {
        return withTime ? SHORT_YEAR_DATETIME_MASK_MAX_LENGTH : SHORT_YEAR_DATE_MASK_MAX_LENGTH
    }
    return withTime ? DATETIME_MASK_MAX_LENGTH : DATE_MASK_MAX_LENGTH
}

export function extractDateDigits(value, withTime = false, shortYear = false) {
    return String(value ?? '').replace(/\D/g, '').slice(0, maxDigits(withTime, shortYear))
}

export function formatDateDigits(digits, withTime = false, shortYear = false) {
    const day = digits.slice(0, 2)
    const month = digits.slice(2, 4)
    const yearEnd = shortYear ? 6 : 8
    const year = digits.slice(4, yearEnd)
    const hourStart = yearEnd
    const minuteStart = hourStart + 2

    let formatted = day
    if (digits.length > 2) {
        formatted += `.${month}`
    }
    if (digits.length > 4) {
        formatted += `.${year}`
    }
    if (withTime && digits.length > hourStart) {
        formatted += shortYear ? `. ${digits.slice(hourStart, hourStart + 2)}` : ` ${digits.slice(hourStart, hourStart + 2)}`
    }
    if (withTime && digits.length > minuteStart) {
        formatted += `:${digits.slice(minuteStart, minuteStart + 2)}`
    }
    return formatted
}

export function getDigitIndexFromCaret(caret, value, withTime = false, shortYear = false) {
    return extractDateDigits(String(value ?? '').slice(0, caret), withTime, shortYear).length
}

export function getCaretForDigitIndex(digitIndex, withTime = false, shortYear = false) {
    if (digitIndex <= 0) return 0
    if (digitIndex <= 2) return digitIndex === 2 ? 3 : digitIndex
    if (digitIndex <= 4) return digitIndex === 4 ? 6 : digitIndex + 1

    if (shortYear) {
        if (digitIndex <= 6) return digitIndex === 6 ? (withTime ? 10 : SHORT_YEAR_DATE_MASK_MAX_LENGTH) : digitIndex + 2
        if (!withTime) return SHORT_YEAR_DATE_MASK_MAX_LENGTH
        if (digitIndex <= 8) return digitIndex === 8 ? 13 : digitIndex + 4
        return Math.min(digitIndex + 5, SHORT_YEAR_DATETIME_MASK_MAX_LENGTH)
    }

    if (digitIndex <= 8) {
        if (digitIndex === 8) return withTime ? 11 : DATE_MASK_MAX_LENGTH
        return digitIndex + 2
    }
    if (!withTime) return DATE_MASK_MAX_LENGTH
    if (digitIndex <= 10) return digitIndex === 10 ? 14 : digitIndex + 3
    return Math.min(digitIndex + 4, DATETIME_MASK_MAX_LENGTH)
}

export function applyDigitToDateInput(input, digit, withTime = false, shortYear = false) {
    const caret = input.selectionStart ?? input.value.length
    const selectionEnd = input.selectionEnd ?? caret
    const digits = extractDateDigits(input.value, withTime, shortYear)

    const digitIndexStart = getDigitIndexFromCaret(caret, input.value, withTime, shortYear)
    const digitIndexEnd = getDigitIndexFromCaret(selectionEnd, input.value, withTime, shortYear)

    const nextDigits = `${digits.slice(0, digitIndexStart)}${digit}${digits.slice(digitIndexEnd)}`.slice(
        0,
        maxDigits(withTime, shortYear),
    )
    const formatted = formatDateDigits(nextDigits, withTime, shortYear)
    const nextCaret = getCaretForDigitIndex(
        Math.min(digitIndexStart + 1, nextDigits.length),
        withTime,
        shortYear,
    )

    input.value = formatted
    input.setSelectionRange(nextCaret, nextCaret)
    input.dispatchEvent(new Event('input', { bubbles: true }))
}

export function applyPastedDigitsToDateInput(input, pastedText, withTime = false, shortYear = false) {
    const caret = input.selectionStart ?? input.value.length
    const selectionEnd = input.selectionEnd ?? caret
    const digits = extractDateDigits(input.value, withTime, shortYear)
    const pastedDigits = extractDateDigits(pastedText, withTime, shortYear)

    const digitIndexStart = getDigitIndexFromCaret(caret, input.value, withTime, shortYear)
    const digitIndexEnd = getDigitIndexFromCaret(selectionEnd, input.value, withTime, shortYear)

    const nextDigits = `${digits.slice(0, digitIndexStart)}${pastedDigits}${digits.slice(digitIndexEnd)}`.slice(
        0,
        maxDigits(withTime, shortYear),
    )
    const formatted = formatDateDigits(nextDigits, withTime, shortYear)
    const nextCaret = getCaretForDigitIndex(
        Math.min(digitIndexStart + pastedDigits.length, nextDigits.length),
        withTime,
        shortYear,
    )

    input.value = formatted
    input.setSelectionRange(nextCaret, nextCaret)
    input.dispatchEvent(new Event('input', { bubbles: true }))
}

export function advanceCaretToNextDateSection(input, withTime = false, shortYear = false) {
    const caret = input.selectionStart ?? 0
    const digits = extractDateDigits(input.value, withTime, shortYear)

    if (caret <= 2 && digits.length >= 2) {
        input.setSelectionRange(3, 3)
        return
    }
    if (caret <= 5 && digits.length >= 4) {
        input.setSelectionRange(6, 6)
        return
    }
    if (shortYear) {
        if (withTime && caret <= 8 && digits.length >= 6) {
            input.setSelectionRange(10, 10)
            return
        }
        if (withTime && caret <= 12 && digits.length >= 8) {
            input.setSelectionRange(13, 13)
            return
        }
        const end = maxLength(withTime, shortYear)
        input.setSelectionRange(end, end)
        return
    }
    if (withTime && caret <= 10 && digits.length >= 8) {
        input.setSelectionRange(11, 11)
        return
    }
    if (withTime && caret <= 13 && digits.length >= 10) {
        input.setSelectionRange(14, 14)
        return
    }
    const end = maxLength(withTime, shortYear)
    input.setSelectionRange(end, end)
}

export function normalizeDateInputMask(input, withTime = false, shortYear = false) {
    const caret = input.selectionStart ?? input.value.length
    const digitsBefore = getDigitIndexFromCaret(caret, input.value, withTime, shortYear)
    const digits = extractDateDigits(input.value, withTime, shortYear)
    const formatted = formatDateDigits(digits, withTime, shortYear)

    if (input.value === formatted) return false

    input.value = formatted
    const nextCaret = getCaretForDigitIndex(digitsBefore, withTime, shortYear)
    input.setSelectionRange(nextCaret, nextCaret)
    return true
}
