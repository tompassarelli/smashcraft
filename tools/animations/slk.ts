
import {ensure} from './original-clips';

function fields(line: string) {
    const result: string[] = [];
    let field = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            field += char;
            if (quoted && line[i + 1] === '"') field += line[++i];
            else quoted = !quoted;
        } else if (char === ';' && !quoted) {
            result.push(field);
            field = '';
        } else field += char;
    }
    ensure(!quoted, 'Unterminated SYLK string');
    result.push(field);
    return result;
}

export function slkRows(text: string): Record<string, string>[] {
    const cells = new Map<number, Map<number, string>>();
    let x = 0, y = 0;
    for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith('C;')) continue;
        let value: string | undefined;
        for (const field of fields(line).slice(1)) {
            if (field.startsWith('X')) x = Number(field.slice(1));
            else if (field.startsWith('Y')) y = Number(field.slice(1));
            else if (field.startsWith('K')) {
                const raw = field.slice(1);
                if (raw.startsWith('"')) {
                    ensure(raw.endsWith('"'), 'Malformed SYLK string');
                    value = raw.slice(1, -1).replaceAll('""', '"');
                } else value = raw;
            }
        }
        ensure(Number.isInteger(x) && x > 0 && Number.isInteger(y) && y > 0, 'Invalid SYLK cell coordinates');
        if (value === undefined) continue;
        if (!cells.has(y)) cells.set(y, new Map());
        const row = cells.get(y)!;
        ensure(!row.has(x), `Duplicate SYLK cell ${x},${y}`);
        row.set(x, value);
    }
    const headers = cells.get(1);
    ensure(headers?.size, 'Missing SYLK header');
    ensure(new Set(headers.values()).size === headers.size, 'Duplicate SYLK header');
    return [...cells.entries()].filter(([row]) => row > 1).sort(([a], [b]) => a - b).map(([, row]) =>
        Object.fromEntries([...row].map(([column, value]) => {
            ensure(headers.has(column), `SYLK column ${column} has no header`);
            return [headers.get(column)!, value];
        })));
}
