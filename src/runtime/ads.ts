import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, BannerAdPosition } from '@capacitor-community/admob';
import type { AdSettings } from '../format/types';

/** Google's public sample ad units for Android. They always serve test ads. */
const TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';
const TEST_REWARDED = 'ca-app-pub-3940256099942544/5224354917';
/** Full-screen ads closer together than this annoy players and break AdMob's placement rules. */
const MIN_GAP_MS = 45_000;

export interface Ads {
  /** Shows a full-screen ad if one is loaded and enough time has passed; otherwise does nothing. */
  showInterstitial: () => void;
  /** Shows an ad the player chose to watch. Resolves true only if they watched it to the end. */
  showRewarded: () => Promise<boolean>;
}

const NO_ADS: Ads = { showInterstitial: () => {}, showRewarded: () => Promise.resolve(false) };

/**
 * Starts ads for a game. Only does anything inside the installed Android app
 * with ads switched on; in a browser it returns a stand-in that does nothing.
 * Any failure (no network, ads blocked) leaves the game running without ads.
 */
export async function startAds(settings: AdSettings): Promise<Ads> {
  if (!settings.enabled || !Capacitor.isNativePlatform()) return NO_ADS;
  try {
    await AdMob.initialize({ initializeForTesting: settings.testMode });

    // Players in regions with consent laws must be asked before personalised ads.
    const consent = await AdMob.requestConsentInfo();
    if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
      await AdMob.showConsentForm();
    }

    const bannerId = settings.testMode ? TEST_BANNER : settings.bannerId;
    if (settings.banner && bannerId) {
      void AdMob.showBanner({ adId: bannerId, isTesting: settings.testMode, position: BannerAdPosition.BOTTOM_CENTER }).catch(warn);
    }

    const interstitialId = settings.testMode ? TEST_INTERSTITIAL : settings.interstitialId;
    const rewardedId = settings.testMode ? TEST_REWARDED : settings.rewardedId;
    const showRewarded = async () => {
      if (!rewardedId) return false;
      try {
        await AdMob.prepareRewardVideoAd({ adId: rewardedId, isTesting: settings.testMode });
        // Resolves with the reward once the ad has been watched; closing it early rejects.
        await AdMob.showRewardVideoAd();
        return true;
      } catch (error) {
        warn(error);
        return false;
      }
    };
    if (!interstitialId) return { ...NO_ADS, showRewarded };

    let ready = false;
    let lastShown = 0;
    const load = () =>
      AdMob.prepareInterstitial({ adId: interstitialId, isTesting: settings.testMode }).then(
        () => (ready = true),
        warn,
      );
    void load();

    return {
      showRewarded,
      showInterstitial: () => {
        if (!ready || Date.now() - lastShown < MIN_GAP_MS) return;
        ready = false;
        lastShown = Date.now();
        void AdMob.showInterstitial().catch(warn).finally(load);
      },
    };
  } catch (error) {
    warn(error);
    return NO_ADS;
  }
}

function warn(error: unknown): void {
  console.warn('Ads:', error);
}
