/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const FEW_SHOT_EXAMPLES = {
  "description": "Few-shot examples used by the research paper agent. Example 1 shows a normal synthesis. Example 2 shows how the agent answers when the evidence is not enough.",
  "examples": [
    {
      "input": {
        "question": "Why did attention replace fixed-length encodings in neural machine translation?",
        "retrieved_papers": [
          {
            "id": 1,
            "title": "Neural Machine Translation by Jointly Learning to Align and Translate",
            "authors": ["Dzmitry Bahdanau", "Kyunghyun Cho", "Yoshua Bengio"],
            "year": 2014,
            "abstract": "Conjectures that a fixed-length vector is a bottleneck in encoder-decoder models and proposes letting the model automatically soft-search for the relevant parts of the source sentence."
          },
          {
            "id": 2,
            "title": "Attention Is All You Need",
            "authors": ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
            "year": 2017,
            "abstract": "Proposes the Transformer, based solely on attention and dispensing with recurrence and convolutions. Reports 28.4 BLEU on WMT 2014 English-to-German."
          },
          {
            "id": 3,
            "title": "Deep Residual Learning for Image Recognition",
            "authors": ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
            "year": 2015,
            "abstract": "Presents a residual learning framework to ease the training of very deep networks for image recognition."
          }
        ]
      },
      "output": {
        "reasoning": [
          { "step": "Understand", "result": "The question asks why attention displaced fixed-length encodings. Key concepts: fixed-length vector, attention, translation." },
          { "step": "Screen", "result": "[1] relevant, it addresses the fixed-length bottleneck. [2] relevant, it builds translation on attention alone. [3] not relevant, it is about image recognition." },
          { "step": "Extract", "result": "[1] soft-search over source words. [2] attention-only Transformer, 28.4 BLEU on WMT 2014 English-to-German." },
          { "step": "Compare", "result": "[1] adds attention to a recurrent model. [2] removes recurrence altogether. They form a progression and do not conflict." },
          { "step": "Check", "result": "Each claim maps to [1] or [2]. No claim relies on [3]." },
          { "step": "Conclude", "result": "Two relevant records with abstracts, so confidence is medium." }
        ],
        "answer": "A fixed-length vector was conjectured to be a bottleneck, so the model was allowed to soft-search the source sentence for relevant parts [1]. Later work dropped recurrence and convolutions and relied on attention alone, reporting 28.4 BLEU on WMT 2014 English-to-German [2].",
        "key_findings": [
          { "claim": "A fixed-length vector is conjectured to limit encoder-decoder performance.", "citations": [1] },
          { "claim": "An attention-only model reached 28.4 BLEU on WMT 2014 English-to-German.", "citations": [2] }
        ],
        "excluded_papers": [
          { "id": 3, "reason": "It covers image recognition, not translation." }
        ],
        "gaps": [
          "These records do not explain the cost of attention on very long inputs."
        ],
        "next_steps": [
          "Search for: attention memory complexity long documents"
        ],
        "confidence": "medium"
      }
    },
    {
      "input": {
        "question": "Does daily meditation improve the accuracy of large language models?",
        "retrieved_papers": [
          {
            "id": 1,
            "title": "Attention Is All You Need",
            "authors": ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
            "year": 2017,
            "abstract": "Proposes the Transformer, based solely on attention and dispensing with recurrence and convolutions."
          },
          {
            "id": 2,
            "title": "Deep Residual Learning for Image Recognition",
            "authors": ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
            "year": 2015,
            "abstract": null
          }
        ]
      },
      "output": {
        "reasoning": [
          { "step": "Understand", "result": "The question links a human practice, meditation, to model accuracy. Key concepts: meditation, large language models, accuracy." },
          { "step": "Screen", "result": "[1] not relevant, it matches the word attention but says nothing about meditation. [2] not relevant, and it has no abstract." },
          { "step": "Extract", "result": "No relevant records to extract from." },
          { "step": "Compare", "result": "Nothing to compare." },
          { "step": "Check", "result": "No claim can be supported, so the answer must say that." },
          { "step": "Conclude", "result": "No relevant evidence, so confidence is low." }
        ],
        "answer": "The retrieved papers do not answer this question. None of them study meditation or its link to language models.",
        "key_findings": [],
        "excluded_papers": [
          { "id": 1, "reason": "It matches the word attention only." },
          { "id": 2, "reason": "It is about image recognition." }
        ],
        "gaps": [
          "The question may rest on a false link between meditation and model accuracy."
        ],
        "next_steps": [
          "Search for: mindfulness human-AI collaboration",
          "Search for: large language model accuracy evaluation"
        ],
        "confidence": "low"
      }
    }
  ]
};
