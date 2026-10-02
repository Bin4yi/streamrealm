/** Design system showcase (for docs/design-system.md screenshots). Not linked from the game. */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  ChunkyProgress,
  CoinLoader,
  EmptyArt,
  CoinFly,
  GameButton,
  GameImage,
  GameModal,
  RedBadge,
  ResourcePill,
  RewardBurst,
  RibbonTitle,
  StonePanel,
  StrokeText,
  useFx,
  WoodPanel,
  WorldBackground,
} from '@/components/kit';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { Images } from '@/lib/assets';
import { parchment } from '@/theme/tokens';


export default function KitShowcase() {
  const [coins, setCoins] = useState(120);
  const [modal, setModal] = useState(false);
  const [fly, setFly] = useState(0);
  const toast = useFx((s) => s.toast);
  return (
    <PhoneFrame>
      <WorldBackground>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 18, paddingTop: 30 }}>
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <ResourcePill icon={Images.effect.coin} fallback="🪙" value={coins} label="Coins" coinTarget shine onPlus={() => setCoins(coins + 50)} />
            <ResourcePill icon={Images.effect.streak} fallback="🔥" value={3} label="Streak" />
          </View>
          <RibbonTitle title="KINGDOM UI" />
          <StrokeText size="XL" align="center">
            StrokeText XL
          </StrokeText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <GameButton label="GO" color="green" />
            <GameButton label="INFO" color="blue" />
            <GameButton label="CLAIM" color="orange" icon={Images.effect.coinPile} />
            <GameButton label="ATTACK" color="red" />
            <GameButton label="LOCKED" disabled />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <GameButton size="S" label="SMALL" color="blue" />
            <GameButton size="L" label="LARGE" />
            <GameButton size="Round" label="CHECK" color="orange" icon={Images.marker.player} />
          </View>
          <WoodPanel>
            <Text style={{ color: parchment.text, fontFamily: 'Nunito_700Bold', fontSize: 15 }}>WoodPanel with a parchment inside. Short, simple text.</Text>
            <ChunkyProgress value={3} max={5} style={{ marginTop: 12 }} end={Images.moment.questChest} endFallback="🎁" />
          </WoodPanel>
          <StonePanel inner="teal">
            <StrokeText size="M">StonePanel</StrokeText>
            <ChunkyProgress value={72} max={100} label="Kingdom health 72" color="#3A9AD9" style={{ marginTop: 10 }} />
          </StonePanel>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <View>
              <GameImage src={Images.moment.questScroll} size={56} />
              <RedBadge count={2} />
            </View>
            <GameImage src={null} size={56} fallback="🦊" label="Missing image fallback" />
            <GameButton label="TOAST" color="blue" size="S" onPress={() => toast('Tile conquered! +50', Images.effect.coin, '🪙')} />
            <GameButton label="MODAL" color="orange" size="S" onPress={() => setModal(true)} />
            <GameButton label="COINS" color="green" size="S" onPress={() => setFly((f) => f + 1)} />
          </View>
          <EmptyArt img={Images.moment.emptyTreasures} title="No treasures yet" text="Find a pipe, trash, wildlife, a plant or algae during a check." />
          <EmptyArt img={Images.moment.emptyPeace} title="All is peaceful" text="No disputes right now." />
          <CoinLoader label="Loading…" />
          <RewardBurst size={220}>
            <GameImage src={Images.moment.victory} size={140} />
          </RewardBurst>
        </ScrollView>
        {fly > 0 && <CoinFly key={fly} from={{ x: 200, y: 600 }} onLand={() => setCoins((c) => c + 5)} />}
        <GameModal open={modal} onClose={() => setModal(false)} title="BADGE">
          <RewardBurst size={180}>
            <GameImage src={Images.badge.explorer} size={110} />
          </RewardBurst>
          <Text style={{ color: parchment.text, fontFamily: 'Nunito_700Bold', fontSize: 15, textAlign: 'center' }}>Explore 5 fog tiles to earn this badge.</Text>
        </GameModal>
      </WorldBackground>
    </PhoneFrame>
  );
}
