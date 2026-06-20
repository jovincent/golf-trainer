// Course illustration photos sourced from Wikimedia Commons under free licenses
// (CC BY / CC BY-SA / Public Domain). Each entry keeps the author, license and
// source page for proper attribution, shown in the carousel caption.

export interface CoursePhoto { url: string; author: string; license: string; source: string }

export const COURSE_PHOTOS: Record<string, CoursePhoto> = {
  "st-andrews-old": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/R%26A_Clubhouse%2C_Old_Course%2C_Swilcan_Burn_bridge.jpg/1280px-R%26A_Clubhouse%2C_Old_Course%2C_Swilcan_Burn_bridge.jpg", author: "Optograph", license: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/w/index.php?curid=21067710" },
  "augusta-national": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Augusta_National_Golf_Club%2C_Hole_10_%28Camellia%29_-_cropped.jpg/1280px-Augusta_National_Golf_Club%2C_Hole_10_%28Camellia%29_-_cropped.jpg", author: "Wikimedia Commons", license: "Public domain", source: "https://commons.wikimedia.org/w/index.php?curid=68318074" },
  "pebble-beach": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Pebble_Beach_Golf_Links%2C_18th_green.jpg/1280px-Pebble_Beach_Golf_Links%2C_18th_green.jpg", author: "WilliamFMeyer", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/w/index.php?curid=41475914" },
  "tpc-sawgrass": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/TPC_Sawgrass_17.jpg/1280px-TPC_Sawgrass_17.jpg", author: "Craig ONeal", license: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=3711876" },
  "pinehurst-no2": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Pinehurst_No._2.JPG/1280px-Pinehurst_No._2.JPG", author: "Zhans33", license: "Public domain", source: "https://commons.wikimedia.org/w/index.php?curid=7977126" },
  "carnoustie": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Carnoustie_Golf_Links.jpg/1280px-Carnoustie_Golf_Links.jpg", author: "Macieklew", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/w/index.php?curid=135158911" },
  "muirfield": { url: "https://upload.wikimedia.org/wikipedia/commons/6/67/Muirfield_Golf_Course-geograph-3531428-by-Jim-Barton.jpg", author: "Jim Barton", license: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=98725063" },
  "royal-county-down": { url: "https://upload.wikimedia.org/wikipedia/commons/1/14/Royal_County_Down_Golf_Club-geograph-4029611-by-Eric-Jones.jpg", author: "Eric Jones", license: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=98333433" },
  "royal-birkdale": { url: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Clubhouse_at_Royal_Birkdale_Golf_Club_-_geograph.org.uk_-_4744433.jpg", author: "Mike Pennington", license: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=131787209" },
  "kiawah-ocean": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Kiawah_Island_Golf_Resort%2C_Kiawah_Island%2C_South_Carolina.jpg/1280px-Kiawah_Island_Golf_Resort%2C_Kiawah_Island%2C_South_Carolina.jpg", author: "Bill Showalter from Greeneville Tennessee, USA", license: "CC BY 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=32961235" },
  "whistling-straits": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Whistling_Straights_golf_course%2C_arieal_view.jpg/1280px-Whistling_Straights_golf_course%2C_arieal_view.jpg", author: "ZimZalaBim at en.wikipedia", license: "Public domain", source: "https://commons.wikimedia.org/w/index.php?curid=17749746" },
  "valderrama": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Valderamma_Driving_Range.JPG/1280px-Valderamma_Driving_Range.JPG", author: "Wikimedia Commons", license: "CC BY 2.5", source: "https://commons.wikimedia.org/w/index.php?curid=1665393" },
  "royal-melbourne": { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Innocent_bystanders_%286346157737%29.jpg/1280px-Innocent_bystanders_%286346157737%29.jpg", author: "Hone Morihana", license: "CC BY 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=133111090" },
};

// Generic golf landscape used as a fallback for courses without a dedicated photo.
export const GENERIC_GOLF_PHOTO: CoursePhoto = { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Harbour_Town_Golf_Links_%28Unsplash%29.jpg/1280px-Harbour_Town_Golf_Links_%28Unsplash%29.jpg", author: "Shep McAllister shep979", license: "CC0", source: "https://commons.wikimedia.org/w/index.php?curid=62171646" };
