// Webb-ersättning för Alert — react-native-webs Alert är en no-op,
// så vi mappar till window.alert/window.confirm för demo-flödena.
export const Alert = {
  alert(titel, meddelande, knappar) {
    const text = [titel, meddelande].filter(Boolean).join('\n\n');

    if (!knappar || knappar.length === 0) {
      window.alert(text);
      return;
    }
    if (knappar.length === 1) {
      window.alert(text);
      knappar[0].onPress?.();
      return;
    }

    const bekräfta = knappar.find(k => k.style !== 'cancel') ?? knappar[0];
    const avbryt = knappar.find(k => k.style === 'cancel');
    if (window.confirm(text)) {
      bekräfta.onPress?.();
    } else {
      avbryt?.onPress?.();
    }
  },
};
