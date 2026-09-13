import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import TitleScreen from './src/screens/TitleScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import OddsScreen from './src/screens/OddsScreen';
import ShelfScreen from './src/screens/ShelfScreen';
import PackSelectScreen from './src/screens/PackSelectScreen';
import BuySheet from './src/screens/BuySheet';
import CardRipScreen from './src/screens/CardRipScreen';
import WatchUnboxScreen from './src/screens/WatchUnboxScreen';
import ResultScreen from './src/screens/ResultScreen';
import CollectionScreen from './src/screens/CollectionScreen';
import DropScreen from './src/screens/DropScreen';

// Deliberately a plain state machine rather than react-navigation: the reveal
// must own the screen with no header, no back gesture and no tab bar, and the
// route it exits to is decided by the pack you opened, not by history.
export default function App() {
  const [route, setRoute] = React.useState('title');
  const [balance, setBalance] = React.useState(250000); // integer cents
  const [pending, setPending] = React.useState(null);   // { pack, qty }
  const [sheet, setSheet] = React.useState(null);

  const go = (r) => setRoute(r);

  const openBuy = (pack, qty) => setSheet({ pack, qty });

  const confirm = (pack, qty, totalCents) => {
    setSheet(null);
    setBalance((b) => b - totalCents);
    setPending({ pack, qty, totalCents });
    // Category decides which reveal plays. This is the whole tonal split.
    go(pack.priceCents >= 50000 ? 'unbox' : 'rip');
  };

  const onTab = (t) => {
    if (t === 'Packs') go('shelf');
    if (t === 'Portfolio') go('collection');
    if (t === 'Market') go('drop');
    if (t === 'You') go('odds');
  };

  let screen = null;
  if (route === 'title') screen = <TitleScreen onStart={() => go('onboarding')} />;
  else if (route === 'onboarding') screen = <OnboardingScreen onDone={() => go('gate')} />;
  else if (route === 'gate') screen = <OddsScreen gate onAccept={() => go('shelf')} />;
  else if (route === 'odds') screen = <OddsScreen onAccept={() => go('shelf')} />;
  else if (route === 'shelf') screen = <ShelfScreen onBuy={openBuy} onTab={onTab} />;
  else if (route === 'select') screen = <PackSelectScreen onOpen={(p) => openBuy(p, 1)} onTab={onTab} />;
  else if (route === 'rip') screen = <CardRipScreen onDone={() => go('result')} />;
  else if (route === 'unbox') screen = <WatchUnboxScreen onDone={() => go('collection')} />;
  else if (route === 'result') {
    screen = (
      <ResultScreen
        paidCents={pending ? pending.totalCents : 4500}
        onAgain={() => go('shelf')}
        onCollection={() => go('collection')}
      />
    );
  }
  else if (route === 'collection') screen = <CollectionScreen onTab={onTab} />;
  else if (route === 'drop') screen = <DropScreen state="live" onShelf={() => go('shelf')} onClaim={() => go('unbox')} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      {screen}
      <BuySheet
        visible={!!sheet}
        pack={sheet ? sheet.pack : null}
        qty={sheet ? sheet.qty : 1}
        balanceCents={balance}
        onClose={() => setSheet(null)}
        onConfirm={confirm}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#0A0614' } });
