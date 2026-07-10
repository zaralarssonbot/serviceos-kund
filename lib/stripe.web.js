// Webb-mock för @stripe/stripe-react-native (native-only).
// Payment Sheet finns inte på webben — demo-läget simulerar en lyckad betalning.

export function StripeProvider({ children }) {
  return children;
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({}),
    presentPaymentSheet: async () => {
      const ok = window.confirm(
        'Demo-läge (webb)\n\nStripe Payment Sheet finns bara i mobilappen. Vill du simulera en lyckad kortbetalning?'
      );
      return ok ? {} : { error: { code: 'Canceled', message: 'Avbruten' } };
    },
  };
}
