import { encodeDigipin } from "./digipin";

export const getAddresses = (userEmail) => {
  try {
    const stored = localStorage.getItem(`addresses_${userEmail}`);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading addresses:", error);
    return [];
  }
};

export const saveAddresses = (userEmail, addresses) => {
  try {
    localStorage.setItem(`addresses_${userEmail}`, JSON.stringify(addresses));
  } catch (error) {
    console.error("Error saving addresses:", error);
  }
};

export const addAddress = (userEmail, address) => {
  const addresses = getAddresses(userEmail);
  const newAddress = { id: Date.now(), ...address, createdAt: new Date().toISOString() };
  addresses.push(newAddress);
  saveAddresses(userEmail, addresses);
  return newAddress;
};

export const deleteAddress = (userEmail, addressId) => {
  const addresses = getAddresses(userEmail);
  saveAddresses(userEmail, addresses.filter((addr) => addr.id !== addressId));
};

const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "en-IN,en;q=0.8" } }
    );
    if (!response.ok) return {};
    const data = await response.json();
    const address = data.address || {};
    return {
      displayAddress: data.display_name || "",
      street: address.road || address.pedestrian || address.footway || "",
      city: address.city || address.town || address.village || address.municipality || "",
      district: address.state_district || address.district || "",
      state: address.state || "",
      pincode: address.postcode || "",
      country: address.country || "India",
    };
  } catch (error) {
    console.warn("Reverse geocoding unavailable:", error);
    return {};
  }
};

export const getLocationAddress = async () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error("Geolocation is not supported by your browser."));
    return;
  }

  let bestPosition = null;
  let settled = false;
  let watchId = null;

  const finish = async () => {
    if (settled || !bestPosition) return;
    settled = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);

    try {
      const { latitude, longitude, accuracy } = bestPosition.coords;
      const roundedAccuracy = Number.isFinite(accuracy) ? Math.round(accuracy) : null;
      const digipin = encodeDigipin(latitude, longitude);
      const address = await reverseGeocode(latitude, longitude);

      resolve({
        latitude,
        longitude,
        accuracy: roundedAccuracy,
        locationTimestamp: new Date(bestPosition.timestamp || Date.now()).toISOString(),
        digipin,
        country: address.country || "India",
        displayAddress: address.displayAddress || "",
        street: address.street || "",
        city: address.city || "",
        district: address.district || "",
        state: address.state || "",
        pincode: address.pincode || "",
      });
    } catch (error) {
      reject(error);
    }
  };

  const timeoutId = setTimeout(() => {
    if (!bestPosition) {
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      reject(new Error("Could not get a GPS fix. Please move near a window or outdoors and try again."));
    } else {
      finish();
    }
  }, 20000);

  const onSuccess = (position) => {
    if (settled) return;
    if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
      bestPosition = position;
    }
    // Stop early when the device reports a strong GPS fix.
    if (Number.isFinite(position.coords.accuracy) && position.coords.accuracy <= 10) {
      clearTimeout(timeoutId);
      finish();
    }
  };

  const onError = (error) => {
    if (settled) return;
    if (error.code === 1) {
      settled = true;
      clearTimeout(timeoutId);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      reject(new Error("Location permission denied. Please allow location access and try again."));
    } else if (error.code === 2 && !bestPosition) {
      settled = true;
      clearTimeout(timeoutId);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      reject(new Error("Your device could not determine a location. Try again."));
    }
  };

  watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });
});
