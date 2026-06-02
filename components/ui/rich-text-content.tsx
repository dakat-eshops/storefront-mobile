import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';

/**
 * Renders sanitized HTML from the `details` column in React Native.
 *
 * Uses react-native-render-html which maps the allow-listed HTML tags
 * (p, strong, em, ul, ol, li, a, blockquote, code, h1-h4) to native RN
 * components — no WebView, no DOM.
 *
 * The HTML string has already been sanitized by the NestJS write-path
 * (`sanitizeRichText`) before being stored. This component is a read-only
 * renderer; it never needs to strip additional tags at the RN layer because
 * the allow-list is enforced server-side.
 *
 * SYNC CONTRACT: tag rendering here must stay aligned with the BO allow-list
 * in `BO/e-Shops/packages/db/src/utils/richText.ts`.
 */
type Props = {
  html: string | null | undefined;
};

export function RichTextContent({ html }: Props) {
  const { width } = useWindowDimensions();

  if (!html) return null;

  return (
    <RenderHtml
      contentWidth={width - 32}
      source={{ html }}
      tagsStyles={{
        p: { marginBottom: 8, lineHeight: 22, color: '#374151' },
        strong: { fontWeight: '700' },
        em: { fontStyle: 'italic' },
        h1: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
        h2: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
        h3: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
        h4: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
        ul: { marginBottom: 8 },
        ol: { marginBottom: 8 },
        li: { marginBottom: 4, lineHeight: 22, color: '#374151' },
        blockquote: {
          borderLeftWidth: 3,
          borderLeftColor: '#D1D5DB',
          paddingLeft: 12,
          marginLeft: 0,
          color: '#6B7280',
        },
        code: {
          fontFamily: 'monospace',
          backgroundColor: '#F3F4F6',
          paddingHorizontal: 4,
          borderRadius: 3,
        },
        pre: {
          backgroundColor: '#F3F4F6',
          padding: 12,
          borderRadius: 6,
          overflow: 'scroll',
        },
        a: { color: '#4F46E5', textDecorationLine: 'underline' },
      }}
    />
  );
}
