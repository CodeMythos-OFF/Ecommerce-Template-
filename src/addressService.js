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

export const getLocationAddress = async () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error("Geolocation is not supported by your browser."));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      try {
        const { latitude, longitude, accuracy } = position.coords;
        const digipin = encodeDigipin(latitude, longitude);
        resolve({
          latitude,
          longitude,
          accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
          digipin,
          country: "India"
        });
      } catch (error) {
        reject(error);
      }
    },
    (error) => {
      if (error.code === 1) reject(new Error("Location permission denied. Please allow location access and try again."));
      else if (error.code === 2) reject(new Error("Your device could not determine a location. Try again."));
      else if (error.code === 3) reject(new Error("Location request timed out. Please try again."));
      else reject(new Error("Unable to get your location."));
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
});
