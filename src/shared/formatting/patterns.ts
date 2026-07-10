export const videoPattern = /^(https?:\/\/)?(www\.)?(m\.|music\.)?(youtube\.com|youtu\.?be)\/.+$/;
export const playlistPattern = /[?&]list=[^&]+/;
// export const playlistPattern = /^.*(list=)([^#\&\?]*).*/;
export const isURL = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
export const coverPattern = /\b((covered?\s+by|covers?)|커버|(acoustic|piano|guitar|vocal|어쿠스틱|피아노|기타|보컬)\s+(cover|커버)|(remix|리믹스)|(versions?|버전|ver)|(피처링|ft\.?|피쳐링))\b/i;
