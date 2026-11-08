// Écran principal : une page par lieu, on passe de l'une à l'autre en glissant.
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/ui';
import { WeatherPage } from '../components/WeatherPage';
import { usePlaces } from '../lib/PlaceContext';
import { placeKey, type Place } from '../lib/types';

const BAR = 50;

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
        onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <WeatherPage place={item} bottomInset={bottom} />}
      />

      <View style={[styles.bar, { height: bottom, paddingBottom: insets.bottom }]}>
        {Platform.OS === 'ios' ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <Pressable hitSlop={12} onPress={() => router.push('/radar')} accessibilityLabel="Radar de pluie">
          <Icon name={{ ios: 'map', android: 'map' }} size={22} />
        </Pressable>
        <View style={styles.dots}>
          {places.map((p, i) =>
            p.isGps ? (
              <Icon key={placeKey(p)} name={{ ios: 'location.fill', android: 'near_me' }} size={10} color={i === activeIndex ? '#fff' : 'rgba(255,255,255,0.45)'} />
            ) : (
              <View key={placeKey(p)} style={[styles.dot, { opacity: i === activeIndex ? 1 : 0.45 }]} />
            ),
          )}
        </View>
        <Pressable hitSlop={12} onPress={() => router.push('/villes')} accessibilityLabel="Liste des villes">
          <Icon name={{ ios: 'list.bullet', android: 'list' }} size={22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(10,20,35,0.25)' : 'rgba(10,20,35,0.85)',
    overflow: 'hidden',
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },
});
