import Label from '../../models/Label.js';

export const handleGetLabels = async (req, res) => {
  try {
    const labels = await Label.find().sort({ createdAt: -1 });
    res.status(200).json(labels);
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({ message: 'Server error while fetching labels.' });
  }
};

export const addLabel = async (req, res) => {
  const { name, categories = [] } = req.body; 

  try {
    const newLabel = new Label({ name, categories });

    const savedLabel = await newLabel.save();

    return res.status(201).json({
      success: true,
      message: 'Label created successfully',
      data: savedLabel,
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Label name must be unique',
      });
    }

    console.error('Error adding label:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while adding label',
    });
  }
};