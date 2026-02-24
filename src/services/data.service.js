const fs = require("fs").promises;

class DataService {
  constructor() {
    this.mockData = [];
  }

  async loadMockData(filePath = "./mock-data.json") {
    try {
      const data = await fs.readFile(filePath, "utf-8");
      this.mockData = JSON.parse(data);
      console.log(`Loaded ${this.mockData.length} mock data records`);
      return this.mockData;
    } catch (error) {
      console.error("Error loading mock data:", error);
      throw error;
    }
  }

  getAllData() {
    return this.mockData;
  }

  getDataById(id) {
    return this.mockData.find(item => item.id === id);
  }

  filterData(criteria) {
    // Add filtering logic as needed
    return this.mockData.filter(item => {
      for (const key in criteria) {
        if (item[key] !== criteria[key]) {
          return false;
        }
      }
      return true;
    });
  }
}

module.exports = new DataService();
