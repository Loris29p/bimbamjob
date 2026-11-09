// Écran principal : une page par lieu, on passe de l'une à l'autre en glissant.
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, liquidGlass, Material } from '../components/ui';
import { WeatherPage } from '../components/WeatherPage';
import { tick } from '../lib/hig';
import { usePlaces } from '../lib/PlaceContext';
import { placeKey, type Place } from '../lib/types';

const BAR = 70;

export default function Home() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { places, activeIndex, setActiveIndex } = usePlaces();
  const list = useRef<FlatList<Place>>(null);
  const bottom = BAR + insets.bottom;

  // Quand on choisit une ville depuis la liste, on se place sur sa page.
  useEffect(() => {
    list.current?.scrollToIndex({ index: activeIndex, animated: false });
  }, [activeIndex, places.length]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1520' }}>
      <FlatList
        ref={list}
        data={places}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={placeKey}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        initialScrollIndex={activeIndex}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== activeIndex) tick();
          setActiveIndex(i);
        }}
        renderItem={({ item }) => <WeatherPage place={item} bottomInset={bottom} />}
      />

      {/* Barre flottante : radar · pages · villes */}
      <View pointerEvents="box-none" style={[styles.bar, { bottom: insets.bottom + 6 }]}>
        <Pressable onPress={() => router.push('/radar')} accessibilityLabel="Radar de pluie" style={styles.round}>
          <Material tint="systemChromeMaterialDark" interactive glassTint={null} radius={28} />
          <Icon name={{ ios: 'map', android: 'map' }} size={26} />
        </Pressable>
        <View style={styles.pill}>
          <Material tint="systemChromeMaterialDark" interactive glassTint={null} radius={25} />
          {places.map((p, i) =>
            p.isGps ? (
              <Icon key={placeKey(p)} name={{ ios: 'location.fill', android: 'near_me' }} size={14} color={i === activeIndex ? '#fff' : 'rgba(255,255,255,0.45)'} />
            ) : (
              <View key={placeKey(p)} style={[styles.dot, { opacity: i === activeIndex ? 1 : 0.45 }]} />
            ),
          )}
        </View>
        <Pressable onPress={() => router.push('/villes')} accessibilityLabel="Liste des villes" style={styles.round}>
          <Material tint="systemChromeMaterialDark" interactive glassTint={null} radius={28} />
          <Icon name={{ ios: 'list.bullet', android: 'list' }} size={26} />
        </Pressable>
      </View>
    </View>
  );
}

const glass = {
  // le verre porte sa propre forme : pas de découpe, sinon le reflet du bord disparaît
  overflow: liquidGlass ? ('visible' as const) : ('hidden' as const),
  backgroundColor: liquidGlass ? 'transparent' : Platform.OS === 'ios' ? 'rgba(20,30,50,0.25)' : 'rgba(20,30,50,0.8)',
  borderWidth: liquidGlass ? 0 : StyleSheet.hairlineWidth,
  borderColor: 'rgba(255,255,255,0.3)',
};

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { ...glass, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  pill: { ...glass, height: 50, minWidth: 150, borderRadius: 25, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
});
