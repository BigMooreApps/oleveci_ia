import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { HomeReelsView } from './components/HomeReelsView';
import { Feed } from './components/Feed';
import { ReadyPlansView } from './components/ReadyPlansView';
import { BusinessDirectory } from './components/BusinessDirectory';
import { BusinessAuthScreen } from './components/BusinessAuthScreen';
import { PostDetailModal } from './components/PostDetailModal';
import { BusinessProfileModal } from './components/BusinessProfileModal';
import { ReadyPlanViewerModal } from './components/ready-plans';
import { OfflineIndicator } from './components/OfflineIndicator';
import { WelcomeSplashScreen } from './components/WelcomeSplashScreen';
import { OliSection } from './components/OliSection';
import type { BuilderMode } from './components/ItineraryBuilderModal';
import type { SimulatedReadyPlan } from './data/readyPlansData';
import { Post } from './types';
import { APP_CONFIG } from './config/brand';
import { BellRing, X } from 'lucide-react';

// Lazy loaded heavy views and modals for optimal initial load
const VeciInMapsView = lazy(() => import('./components/VeciInMapsView').then(m => ({ default: m.VeciInMapsView })));
const BusinessDashboard = lazy(() => import('./components/BusinessDashboard').then(m => ({ default: m.BusinessDashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const LocationPickerModal = lazy(() => import('./components/LocationPickerModal').then(m => ({ default: m.LocationPickerModal })));
const PushNotificationManager = lazy(() => import('./components/PushNotificationManager').then(m => ({ default: m.PushNotificationManager })));
const CreatePostModal = lazy(() => import('./components/CreatePostModal').then(m => ({ default: m.CreatePostModal })));
const ItineraryBuilderModal = lazy(() => import('./components/ItineraryBuilderModal').then(m => ({ default: m.ItineraryBuilderModal })));

const ViewLoadingFallback = () => (
  <div className="w-full py-20 flex flex-col items-center justify-center gap-3">
    <div className="w-9 h-9 rounded-full border-3 border-cyan-400 border-t-transparent animate-spin" />
    <span className="text-xs text-slate-400 font-medium">Cargando sección...</span>
  </div>
);

const MainApp: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    activeNotificationToast,
    dismissNotificationToast,
    userLocation,
    setUserLocation,
    currentCity,
    currentSector,
    authenticatedBusinessId,
    posts,
    businesses,
    readyPlans,
    addReadyPlan,
    isAdminAuthenticated,
    setSearchQuery,
  } = useApp();

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPostFromProfile, setSelectedPostFromProfile] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SimulatedReadyPlan | null>(null);
  const [isGlobalItineraryOpen, setIsGlobalItineraryOpen] = useState(false);
  const [globalItineraryMode, setGlobalItineraryMode] = useState<BuilderMode>('mode_select');

  // Business Auth Flow state
  const [showBusinessAuthScreen, setShowBusinessAuthScreen] = useState(false);
  const [businessAuthTab, setBusinessAuthTab] = useState<'login' | 'register'>('login');

  // Shared reel ID state from URL deep link (/reel/:id or ?reel=:id)
  const [sharedReelId, setSharedReelId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const r = searchParams.get('reel');
      if (r) return r;
      const pathname = window.location.pathname;
      if (pathname.startsWith('/reel/')) {
        return pathname.replace('/reel/', '').split('/')[0];
      }
    }
    return null;
  });

  const handleWelcomeSplashFinish = React.useCallback(() => {
    // Al terminar la bienvenida con el logo oficial de OleVeci, respetar deep link o pasar a home
    const searchParams = new URLSearchParams(window.location.search);
    const roleParam = searchParams.get('tab') || searchParams.get('seccion') || searchParams.get('role');
    const pathname = window.location.pathname;

    if (pathname.startsWith('/reel/') || searchParams.has('reel')) {
      setCurrentRole('home');
    } else if (
      pathname.startsWith('/plan/') ||
      pathname.startsWith('/itinerario/') ||
      searchParams.has('plan') ||
      searchParams.has('itinerario')
    ) {
      setCurrentRole('plans');
    } else if (pathname.startsWith('/anuncio/') || searchParams.has('post') || searchParams.has('anuncio')) {
      setCurrentRole('explorer');
    } else if (roleParam === 'descubrir' || roleParam === 'explorer' || pathname === '/descubrir') {
      setCurrentRole('explorer');
    } else if (roleParam === 'business' || roleParam === 'negocio' || roleParam === 'miespacio' || pathname === '/negocio') {
      setCurrentRole('business');
    } else if (roleParam === 'admin' || pathname === '/admin') {
      setCurrentRole('admin');
    } else if (roleParam === 'planes' || roleParam === 'plans' || pathname === '/planes') {
      setCurrentRole('plans');
    } else if (roleParam === 'oli' || roleParam === 'asistente' || pathname === '/oli') {
      setCurrentRole('oli');
    } else {
      setCurrentRole('home');
    }
  }, [setCurrentRole]);

  // Handle direct URLs from WhatsApp or social shares (/anuncio/:id, /reel/:id, /comercio/:id, /plan/:id, /itinerario/:id, ?post=:id, ?reel=:id, ?biz=:id, ?plan=:id)
  useEffect(() => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    let targetPostId = searchParams.get('post') || searchParams.get('anuncio');
    let targetReelId = searchParams.get('reel');
    let targetBizId = searchParams.get('biz') || searchParams.get('comercio');
    let targetPlanId = searchParams.get('plan') || searchParams.get('itinerario');

    const qParam = searchParams.get('q') || searchParams.get('buscar');
    if (qParam) {
      setSearchQuery(qParam);
    }

    if (!targetReelId && pathname.startsWith('/reel/')) {
      targetReelId = pathname.replace('/reel/', '').split('/')[0];
    }

    if (!targetPlanId && pathname.startsWith('/plan/')) {
      targetPlanId = pathname.replace('/plan/', '').split('/')[0];
    } else if (!targetPlanId && pathname.startsWith('/itinerario/')) {
      targetPlanId = pathname.replace('/itinerario/', '').split('/')[0];
    }

    if (!targetPostId && pathname.startsWith('/anuncio/')) {
      targetPostId = pathname.replace('/anuncio/', '').split('/')[0];
    } else if (!targetPostId && pathname.startsWith('/p/')) {
      targetPostId = pathname.replace('/p/', '').split('/')[0];
    }

    if (!targetBizId && pathname.startsWith('/comercio/')) {
      targetBizId = pathname.replace('/comercio/', '').split('/')[0];
    }

    const roleParam = searchParams.get('tab') || searchParams.get('seccion') || searchParams.get('role');
    if (targetReelId) {
      setSharedReelId(targetReelId);
      setCurrentRole('home');
    } else if (targetPlanId) {
      setCurrentRole('plans');
    } else if (targetPostId) {
      setCurrentRole('explorer');
    } else if (roleParam === 'descubrir' || roleParam === 'explorer' || pathname === '/descubrir') {
      setCurrentRole('explorer');
    } else if (roleParam === 'business' || roleParam === 'negocio' || roleParam === 'miespacio' || pathname === '/negocio') {
      setCurrentRole('business');
    } else if (roleParam === 'admin' || pathname === '/admin') {
      setCurrentRole('admin');
    } else if (roleParam === 'planes' || roleParam === 'plans' || pathname === '/planes') {
      setCurrentRole('plans');
    } else if (roleParam === 'oli' || roleParam === 'asistente' || pathname === '/oli') {
      setCurrentRole('oli');
    }

    // Resolve target shared itinerary
    if (targetPlanId) {
      const cleanPlanId = targetPlanId.startsWith('itinerary_') ? targetPlanId.replace('itinerary_', '') : targetPlanId;
      const foundPlan = readyPlans.find(
        (p) => p.id === cleanPlanId || p.id === targetPlanId || `itinerary_${p.id}` === targetPlanId
      );
      if (foundPlan) {
        setSelectedPlan(foundPlan);
      } else {
        // Fetch from backend in case it was created dynamically on another device
        fetch(`/api/plans/${encodeURIComponent(cleanPlanId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.id) {
              setSelectedPlan(data);
              addReadyPlan(data);
            }
          })
          .catch(() => {});
      }
    }

    if (targetPostId && posts.length > 0) {
      const foundPost = posts.find((p) => p.id === targetPostId);
      if (foundPost) {
        setSelectedPostFromProfile(false);
        setSelectedPost(foundPost);
      } else {
        // Fallback fetch if post was newly created or persisted in server
        fetch(`/api/posts/${targetPostId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.id) {
              setSelectedPostFromProfile(false);
              setSelectedPost(data);
            }
          })
          .catch(() => {});
      }
    } else if (targetBizId && businesses.length > 0) {
      const foundBiz = businesses.find((b) => b.id === targetBizId);
      if (foundBiz) {
        setSelectedBusinessId(foundBiz.id);
      }
    }
  }, [posts, businesses, readyPlans, addReadyPlan, setCurrentRole]);

  const previouslyOpenModalRef = useRef(false);

  // Keep browser URL cleanly synchronized when viewing an announcement, business or itinerary
  useEffect(() => {
    if (selectedPost) {
      previouslyOpenModalRef.current = true;
      window.history.replaceState({}, '', `/anuncio/${selectedPost.id}`);
    } else if (selectedBusinessId) {
      previouslyOpenModalRef.current = true;
      window.history.replaceState({}, '', `/comercio/${selectedBusinessId}`);
    } else if (selectedPlan) {
      previouslyOpenModalRef.current = true;
      window.history.replaceState({}, '', `/plan/${selectedPlan.id}`);
    } else if (previouslyOpenModalRef.current) {
      // User closed the modal
      previouslyOpenModalRef.current = false;
      const base = currentRole === 'home' ? '/' : `/${currentRole}`;
      window.history.replaceState({}, '', base);
    }
  }, [selectedPost, selectedBusinessId, selectedPlan, currentRole]);

  useEffect(() => {
    (window as any).__openCreatePost = (post?: Post) => {
      setEditingPost(post || null);
      setIsCreatePostOpen(true);
    };

    const handleOpenRegister = () => {
      setBusinessAuthTab('register');
      setShowBusinessAuthScreen(true);
      setCurrentRole('business');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    (window as any).__openCreateBusiness = handleOpenRegister;
    window.addEventListener('oleveci:open-register', handleOpenRegister);

    return () => {
      window.removeEventListener('oleveci:open-register', handleOpenRegister);
    };
  }, [setCurrentRole]);


  return (
    <div className={`min-h-screen ${currentRole === 'home' ? 'bg-[#030d1d]' : currentRole === 'oli' ? 'bg-[#0047e1]' : 'bg-[#F2F6FA]'} flex flex-col text-slate-900 font-sans antialiased selection:bg-[#007af7] selection:text-white`}>
      {/* Welcome Presentation Splash Animation (snappy and skippable) */}
      <WelcomeSplashScreen durationMs={1200} onFinish={handleWelcomeSplashFinish} />

      {/* Offline Connectivity Alert */}
      <OfflineIndicator />

      {/* Real-time In-App Push Notification Toast */}
      {activeNotificationToast && (
        <div
          id="global-notification-toast"
          role="alert"
          aria-live="assertive"
          className="fixed top-4 right-4 z-50 max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:w-full bg-[#08152c]/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-[0_12px_40px_rgba(0,180,216,0.22),0_4px_16px_rgba(0,0,0,0.5)] border border-[#00d8a5]/35 backdrop-blur-md flex items-start gap-3.5 animate-in slide-in-from-top duration-300 ring-1 ring-white/10 overflow-hidden group"
        >
          {/* Top brand gradient line (OleVeci Turquoise to Sky Blue) */}
          <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-[#00d8a5] via-[#00b4d8] to-[#007af7]" />

          {/* Subtle turquoise background ambient glow */}
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#00d8a5]/15 rounded-full blur-xl pointer-events-none" />

          {/* Turquoise Icon Badge */}
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#00d8a5] to-[#00b4d8] flex items-center justify-center text-[#021b58] shrink-0 mt-0.5 shadow-md shadow-[#00d8a5]/30">
            <BellRing className="w-4 h-4 text-[#021b58]" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#08152c] animate-pulse" />
          </div>

          {/* Text Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-[#00e5b8] tracking-tight truncate">
                {activeNotificationToast.title}
              </h4>
              <span className="text-[10px] text-[#00b4d8]/80 font-semibold shrink-0">
                {activeNotificationToast.time || 'Ahora'}
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-1 leading-relaxed font-medium">
              {activeNotificationToast.body}
            </p>
          </div>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={dismissNotificationToast}
            className="p-1.5 text-slate-400 hover:text-[#00e5b8] hover:bg-white/10 rounded-xl transition cursor-pointer shrink-0 active:scale-95"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <Header
        onOpenLocationPicker={() => setIsLocationPickerOpen(true)}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        onOpenBusinessAuth={(tab = 'login') => {
          setBusinessAuthTab(tab);
          setShowBusinessAuthScreen(true);
          setCurrentRole('business');
        }}
        onOpenOliAssistant={() => {
          setCurrentRole('oli');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Main Body */}
      <main className={`flex-1 ${currentRole === 'home' || currentRole === 'maps' || currentRole === 'oli' ? 'pb-0 flex flex-col' : 'pb-12'}`}>
        {currentRole === 'home' && (
          <HomeReelsView
            targetReelId={sharedReelId}
            isPaused={Boolean(
              selectedPost ||
              selectedBusinessId ||
              isCreatePostOpen ||
              isGlobalItineraryOpen ||
              isLocationPickerOpen ||
              isNotificationModalOpen
            )}
            onSelectPost={(post) => {
              setSelectedPostFromProfile(false);
              setSelectedPost(post);
            }}
            onSelectBusiness={(businessId) => setSelectedBusinessId(businessId)}
            onOpenItineraryBuilder={() => {
              setGlobalItineraryMode('manual');
              setIsGlobalItineraryOpen(true);
            }}
          />
        )}

        {currentRole === 'explorer' && (
          <Feed
            onSelectPost={(post) => {
              setSelectedPostFromProfile(false);
              setSelectedPost(post);
            }}
            onSelectBusiness={(businessId) => setSelectedBusinessId(businessId)}
            onOpenCreatePost={() => {
              if (!authenticatedBusinessId) {
                setBusinessAuthTab('login');
                setShowBusinessAuthScreen(true);
              }
              setCurrentRole('business');
              if (authenticatedBusinessId) {
                setIsCreatePostOpen(true);
              }
            }}
            onOpenCreateBusiness={() => {
              setBusinessAuthTab('register');
              setShowBusinessAuthScreen(true);
              setCurrentRole('business');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenLocationPicker={() => setIsLocationPickerOpen(true)}
          />
        )}

        {currentRole === 'plans' && (
          <ReadyPlansView
            onSelectPost={(post) => {
              setSelectedPostFromProfile(false);
              setSelectedPost(post);
            }}
            onSelectBusiness={(businessId) => setSelectedBusinessId(businessId)}
            onSelectPlan={(plan) => setSelectedPlan(plan)}
            onOpenItineraryBuilder={(mode) => {
              setGlobalItineraryMode(mode || 'manual');
              setIsGlobalItineraryOpen(true);
            }}
            onOpenOliAssistant={() => {
              setCurrentRole('oli');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentRole === 'oli' && (
          <OliSection
            onSelectPlan={(plan) => setSelectedPlan(plan)}
            onSelectBusiness={(businessId) => setSelectedBusinessId(businessId)}
            onSelectPost={(post) => {
              setSelectedPostFromProfile(false);
              setSelectedPost(post);
            }}
            onOpenItineraryBuilder={(plan) => {
              setSelectedPlan(plan);
              setGlobalItineraryMode('manual');
              setIsGlobalItineraryOpen(true);
            }}
          />
        )}

        {currentRole === 'maps' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <VeciInMapsView
              onSelectBusiness={(businessId) => setSelectedBusinessId(businessId)}
              onSelectPost={(post) => {
                setSelectedPostFromProfile(false);
                setSelectedPost(post);
              }}
            />
          </Suspense>
        )}

        {currentRole === 'directory' && (
          <BusinessDirectory
            onSelectBusiness={(businessId) => setSelectedBusinessId(businessId)}
            onSelectPost={(post) => {
              setSelectedPostFromProfile(false);
              setSelectedPost(post);
            }}
          />
        )}

        {currentRole === 'business' && (
          !authenticatedBusinessId || showBusinessAuthScreen ? (
            <BusinessAuthScreen
              initialTab={businessAuthTab}
              onSuccessLogin={(_bizId) => {
                setShowBusinessAuthScreen(false);
              }}
              onCancel={() => {
                setShowBusinessAuthScreen(false);
                setCurrentRole('explorer');
              }}
            />
          ) : (
            <Suspense fallback={<ViewLoadingFallback />}>
              <BusinessDashboard
                onOpenCreatePost={() => setIsCreatePostOpen(true)}
                onSelectPost={(post) => {
                  setSelectedPostFromProfile(false);
                  setSelectedPost(post);
                }}
                onOpenAuthScreen={(tab) => {
                  setBusinessAuthTab(tab);
                  setShowBusinessAuthScreen(true);
                }}
              />
            </Suspense>
          )
        )}

        {currentRole === 'admin' && (
          isAdminAuthenticated ? (
            <Suspense fallback={<ViewLoadingFallback />}>
              <AdminDashboard />
            </Suspense>
          ) : (
            <BusinessAuthScreen
              initialTab="login"
              onSuccessLogin={() => {
                setShowBusinessAuthScreen(false);
              }}
              onCancel={() => {
                setShowBusinessAuthScreen(false);
                setCurrentRole('explorer');
              }}
            />
          )
        )}
      </main>

      {/* Modals */}
      {isLocationPickerOpen && (
        <Suspense fallback={null}>
          <LocationPickerModal
            isOpen={isLocationPickerOpen}
            onClose={() => setIsLocationPickerOpen(false)}
            cityName={currentCity}
            sectorName={currentSector === 'all' ? 'Centro' : currentSector}
            initialAddress=""
            initialCoordinates={userLocation || APP_CONFIG.pilotCoordinates}
            onSelectLocation={(_address, coords) => {
              setUserLocation(coords);
              setIsLocationPickerOpen(false);
            }}
          />
        </Suspense>
      )}

      {isNotificationModalOpen && (
        <Suspense fallback={null}>
          <PushNotificationManager
            isOpen={isNotificationModalOpen}
            onClose={() => setIsNotificationModalOpen(false)}
          />
        </Suspense>
      )}

      <PostDetailModal
        post={selectedPost}
        onClose={() => {
          setSelectedPost(null);
          setSelectedPostFromProfile(false);
        }}
        onSelectBusiness={(businessId) => {
          setSelectedPost(null);
          setSelectedPostFromProfile(false);
          setSelectedBusinessId(businessId);
        }}
        onBackToProfile={(businessId) => {
          setSelectedPost(null);
          setSelectedPostFromProfile(false);
          setSelectedBusinessId(businessId);
        }}
        fromBusinessProfile={selectedPostFromProfile}
        onSelectPost={(nextPost) => setSelectedPost(nextPost)}
        isBusinessSection={currentRole === 'business'}
        onEditPost={(postToEdit) => {
          setSelectedPost(null);
          setSelectedPostFromProfile(false);
          setEditingPost(postToEdit);
          setIsCreatePostOpen(true);
        }}
      />

      <BusinessProfileModal
        businessId={selectedBusinessId}
        onClose={() => setSelectedBusinessId(null)}
        onSelectPost={(post) => {
          setSelectedBusinessId(null);
          setSelectedPostFromProfile(true);
          setSelectedPost(post);
        }}
      />

      {isCreatePostOpen && (
        <Suspense fallback={null}>
          <CreatePostModal
            isOpen={isCreatePostOpen}
            onClose={() => {
              setIsCreatePostOpen(false);
              setEditingPost(null);
            }}
            editingPost={editingPost}
            onPostCreated={(post) => {
              setSelectedPostFromProfile(false);
              setSelectedPost(post);
            }}
          />
        </Suspense>
      )}

      {/* Global Itinerary Builder Modal */}
      {isGlobalItineraryOpen && (
        <Suspense fallback={null}>
          <ItineraryBuilderModal
            isOpen={isGlobalItineraryOpen}
            initialMode={globalItineraryMode}
            onClose={() => setIsGlobalItineraryOpen(false)}
            onSelectBusiness={(bizId) => setSelectedBusinessId(bizId)}
            onSelectPost={(post) => setSelectedPost(post)}
            onNavigateToDescubre={() => {
              setIsGlobalItineraryOpen(false);
              setCurrentRole('explorer');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenOliAssistant={() => {
              setIsGlobalItineraryOpen(false);
              setCurrentRole('oli');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </Suspense>
      )}

      {/* Shared Itinerary Modal (Direct deep link / shared URL / plan preview) */}
      <ReadyPlanViewerModal
        plan={selectedPlan}
        posts={posts}
        currentCity={selectedPlan?.municipality || currentCity}
        onClose={() => setSelectedPlan(null)}
        onSelectPost={(post) => setSelectedPost(post)}
        onOpenItineraryBuilder={(mode) => {
          setSelectedPlan(null);
          setGlobalItineraryMode(mode || 'manual');
          setIsGlobalItineraryOpen(true);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
