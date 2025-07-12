import Label from '../../models/Label.js';

export const handleGetLabels = async (req, res) => {
    console.log(req)
  try {
    const labels = await Label.find().sort({ createdAt: -1 });
    res.status(200).json(labels);
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({ message: 'Server error while fetching labels.' });
  }
};
