// Address Service - Manages user delivery addresses

// Get saved addresses for a user
export const getAddresses = (userEmail) => {
  try {
    const key = `addresses_${userEmail}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading addresses:', error);
    return [];
  }
};

// Save addresses for a user
export const saveAddresses = (userEmail, addresses) => {
  try {
    const key = `addresses_${userEmail}`;
    localStorage.setItem(key, JSON.stringify(addresses));
  } catch (error) {
    console.error('Error saving addresses:', error);
  }
};

// Add a new address
export const addAddress = (userEmail, address) => {
  const addresses = getAddresses(userEmail);
  const newAddress = {
    id: Date.now(),
    ...address,
    createdAt: new Date().toISOString()
  };
  addresses.push(newAddress);
  saveAddresses(userEmail, addresses);
  return newAddress;
};

// Delete an address
export const deleteAddress = (userEmail, addressId) => {
  const addresses = getAddresses(userEmail);
  const filtered = addresses.filter(addr => addr.id !== addressId);
  saveAddresses(userEmail, filtered);
};

// Get address from geolocation
export const getLocationAddress = async () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Use OpenStreetMap Nominatim for reverse geocoding (free, no API key needed)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'ShopMaster-App'
              }
            }
          );
          
          if (!response.ok) {
            throw new Error('Failed to fetch address');
          }
          
          const data = await response.json();
          const addr = data.address || {};
          
          // Extract address components
          const address = {
            fullAddress: data.display_name || '',
            street: addr.road || addr.street || '',
            city: addr.city || addr.town || addr.village || '',
            state: addr.state || '',
            pincode: addr.postcode || '',
            country: addr.country || 'India',
            latitude,
            longitude
          };
          
          resolve(address);
        } catch (error) {
          reject(new Error('Failed to get address from location'));
        }
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};
