import os
import sys

# Ensure python-pptx is installed
try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN
    from pptx.enum.shapes import MSO_SHAPE
except ImportError:
    print("python-pptx is not installed. Installing it now...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-pptx"])
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN
    from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    
    # Set slide dimensions to 16:9 widescreen
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    blank_slide_layout = prs.slide_layouts[6]
    
    # Modern color palette definitions
    DARK_BG = RGBColor(15, 23, 42)      # Slate 900
    WHITE_BG = RGBColor(248, 250, 252)  # Slate 50
    CARD_BG = RGBColor(255, 255, 255)
    
    TEXT_DARK = RGBColor(15, 23, 42)
    TEXT_LIGHT = RGBColor(248, 250, 252)
    TEXT_MUTED = RGBColor(100, 116, 139)
    
    INDIGO = RGBColor(99, 102, 241)     # Indigo 500
    EMERALD = RGBColor(16, 185, 129)    # Emerald 500
    AMBER = RGBColor(245, 158, 11)      # Amber 500
    
    def set_slide_background(slide, color):
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = color

    # -------------------------------------------------------------
    # SLIDE 1: Title Slide (Dark Theme)
    # -------------------------------------------------------------
    slide1 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(slide1, DARK_BG)
    
    # Title Text Box
    txBox = slide1.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(11.333), Inches(3.0))
    tf = txBox.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = "NSE PREDICTOR"
    p.font.size = Pt(54)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    p.font.name = 'Arial'
    
    p2 = tf.add_paragraph()
    p2.text = "Advanced Trading & Risk Management Workflow"
    p2.font.size = Pt(28)
    p2.font.bold = True
    p2.font.color.rgb = TEXT_LIGHT
    p2.font.name = 'Arial'
    p2.space_before = Pt(10)
    
    p3 = tf.add_paragraph()
    p3.text = "Utilizing Market Regime Guard, Machine Learning Rankings, and Portfolio Backtesting"
    p3.font.size = Pt(16)
    p3.font.color.rgb = TEXT_MUTED
    p3.font.name = 'Arial'
    p3.space_before = Pt(15)

    # -------------------------------------------------------------
    # SLIDE 2: Step 1 - Market Regime Guards (Regime Protection)
    # -------------------------------------------------------------
    slide2 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(slide2, WHITE_BG)
    
    # Title
    txBox = slide2.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.8))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = "Step 1: Check Market Health (Regime Guard)"
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = TEXT_DARK
    
    # Left Column (Concepts)
    leftBox = slide2.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(5.5), Inches(5.0))
    tf_left = leftBox.text_frame
    tf_left.word_wrap = True
    
    p = tf_left.paragraphs[0]
    p.text = "🛡️ Capital Protection First"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = INDIGO
    p.space_after = Pt(8)
    
    p = tf_left.add_paragraph()
    p.text = "Before taking any trade, the system automatically checks the position of the Nifty 50 Index relative to its 200 EMA to classify the market state."
    p.font.size = Pt(14)
    p.font.color.rgb = TEXT_DARK
    p.space_after = Pt(20)
    
    p = tf_left.add_paragraph()
    p.text = "🔑 Key Metrics Checked:"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = TEXT_DARK
    p.space_after = Pt(8)
    
    bullets = [
        "Nifty Index > 200 EMA → Bull Market (Normal Trading)",
        "Nifty Index < 200 EMA → Bear Market (Risk-Off Phase)"
      ]
    for b in bullets:
        p = tf_left.add_paragraph()
        p.text = "• " + b
        p.font.size = Pt(14)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(4)

    # Right Column (Visual Card for Bear Market changes)
    shape = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.0), Inches(1.5), Inches(5.5), Inches(4.5))
    shape.fill.solid()
    shape.fill.fore_color.rgb = CARD_BG
    shape.line.color.rgb = AMBER
    shape.line.width = Pt(2)
    
    rightBox = slide2.shapes.add_textbox(Inches(7.2), Inches(1.7), Inches(5.1), Inches(4.1))
    tf_right = rightBox.text_frame
    tf_right.word_wrap = True
    
    p = tf_right.paragraphs[0]
    p.text = "⚠️ Bear Market Adjustments (Activated)"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = AMBER
    p.space_after = Pt(12)
    
    adjustments = [
        "Tightened Entry rules: Minimum confidence threshold is automatically raised by +5% to filter out fake breakouts.",
        "Wider Stop Losses: ATR stop multiplier is increased by +0.5x to prevent market volatility from stopping you out early.",
        "Outcome: Automatically limits trade sizes and avoids capital drawdowns."
    ]
    for adj in adjustments:
        p = tf_right.add_paragraph()
        p.text = "✔ " + adj
        p.font.size = Pt(13)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(10)

    # -------------------------------------------------------------
    # SLIDE 3: Step 2 - ML Probability (Ranking Candidates)
    # -------------------------------------------------------------
    slide3 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(slide3, WHITE_BG)
    
    # Title
    txBox = slide3.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.8))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = "Step 2: Rank High-Conviction Setups (ML Prob)"
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = TEXT_DARK
    
    # Left Column
    leftBox = slide3.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(5.5), Inches(5.0))
    tf_left = leftBox.text_frame
    tf_left.word_wrap = True
    
    p = tf_left.paragraphs[0]
    p.text = "🤖 Statistical Filtering"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = INDIGO
    p.space_after = Pt(8)
    
    p = tf_left.add_paragraph()
    p.text = "Instead of sorting stocks alphabetically, the dashboard filters by technical rules first, and then sorts candidates by ML Probability descending."
    p.font.size = Pt(14)
    p.font.color.rgb = TEXT_DARK
    p.space_after = Pt(20)
    
    p = tf_left.add_paragraph()
    p.text = "⚡ LightGBM Classifier details:"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = TEXT_DARK
    p.space_after = Pt(8)
    
    bullets = [
        "Trained on 5 years of historical Nifty daily candles.",
        "Predicts the probability of achieving a >=5% gain in 10 days.",
        "Pure TypeScript interpreter executes trees in 0.001s."
      ]
    for b in bullets:
        p = tf_left.add_paragraph()
        p.text = "• " + b
        p.font.size = Pt(14)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(4)

    # Right Column Visual Card
    shape = slide3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.0), Inches(1.5), Inches(5.5), Inches(4.5))
    shape.fill.solid()
    shape.fill.fore_color.rgb = CARD_BG
    shape.line.color.rgb = INDIGO
    shape.line.width = Pt(2)
    
    rightBox = slide3.shapes.add_textbox(Inches(7.2), Inches(1.7), Inches(5.1), Inches(4.1))
    tf_right = rightBox.text_frame
    tf_right.word_wrap = True
    
    p = tf_right.paragraphs[0]
    p.text = "📈 Execution Workflow"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = INDIGO
    p.space_after = Pt(12)
    
    steps = [
        "Open the Midterm (Mid) or Long-term (Long) tab.",
        "Identify candidates showing high ML Probability (e.g. >60%).",
        "Confirm that indicators (RSI, MACD, Bollinger Bands) align with the trend."
    ]
    for s in steps:
        p = tf_right.add_paragraph()
        p.text = "➜ " + s
        p.font.size = Pt(13)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(12)

    # -------------------------------------------------------------
    # SLIDE 4: Step 3 - Fundamental Quality (Business Checks)
    # -------------------------------------------------------------
    slide4 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(slide4, WHITE_BG)
    
    # Title
    txBox = slide4.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.8))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = "Step 3: Audit Business Quality (Fundamentals)"
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = TEXT_DARK
    
    # Left Column
    leftBox = slide4.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(5.5), Inches(5.0))
    tf_left = leftBox.text_frame
    tf_left.word_wrap = True
    
    p = tf_left.paragraphs[0]
    p.text = "🏢 Mid & Long-Term Filters"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = INDIGO
    p.space_after = Pt(8)
    
    p = tf_left.add_paragraph()
    p.text = "Technical indicators show entry timing, but fundamentals prevent you from buying poor businesses. We look at key leverage, ownership, and margin checks."
    p.font.size = Pt(14)
    p.font.color.rgb = TEXT_DARK
    p.space_after = Pt(20)
    
    p = tf_left.add_paragraph()
    p.text = "🔎 Factor Parameters Evaluated:"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = TEXT_DARK
    p.space_after = Pt(8)
    
    bullets = [
        "Debt-to-Equity ≤ 100% (Avoids bankruptcy risks)",
        "Promoter Holdings ≥ 50% (Aligns owner's interests)",
        "P/E Ratio ≤ 35 (Ensures reasonable valuations)"
      ]
    for b in bullets:
        p = tf_left.add_paragraph()
        p.text = "• " + b
        p.font.size = Pt(14)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(4)

    # Right Column Visual Card
    shape = slide4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.0), Inches(1.5), Inches(5.5), Inches(4.5))
    shape.fill.solid()
    shape.fill.fore_color.rgb = CARD_BG
    shape.line.color.rgb = EMERALD
    shape.line.width = Pt(2)
    
    rightBox = slide4.shapes.add_textbox(Inches(7.2), Inches(1.7), Inches(5.1), Inches(4.1))
    tf_right = rightBox.text_frame
    tf_right.word_wrap = True
    
    p = tf_right.paragraphs[0]
    p.text = "📊 Analysis Popup Indicators"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    p.space_after = Pt(12)
    
    facts = [
        "Found in the 'Analysis' dialog under the 'Factor Breakdown' table.",
        "Displays real-time stats (e.g. 'D/E Ratio: 32%', 'Promoter Held: 62.5%').",
        "Applies negative weights if parameters are breached, lowering confidence score automatically."
    ]
    for f in facts:
        p = tf_right.add_paragraph()
        p.text = "✔ " + f
        p.font.size = Pt(13)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(10)

    # -------------------------------------------------------------
    # SLIDE 5: Step 4 - Portfolio Backtester (System Validation)
    # -------------------------------------------------------------
    slide5 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(slide5, WHITE_BG)
    
    # Title
    txBox = slide5.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.8))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = "Step 4: Validate via Portfolio Backtesting"
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = TEXT_DARK
    
    # Left Column
    leftBox = slide5.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(5.5), Inches(5.0))
    tf_left = leftBox.text_frame
    tf_left.word_wrap = True
    
    p = tf_left.paragraphs[0]
    p.text = "📊 Realistic Simulation"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = INDIGO
    p.space_after = Pt(8)
    
    p = tf_left.add_paragraph()
    p.text = "Do not trade blindly. Run a concurrent simulation to ensure the collection of stocks yields solid portfolio returns with limited drawdown."
    p.font.size = Pt(14)
    p.font.color.rgb = TEXT_DARK
    p.space_after = Pt(20)
    
    p = tf_left.add_paragraph()
    p.text = "⚙️ Simulation Parameters:"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = TEXT_DARK
    p.space_after = Pt(8)
    
    bullets = [
        "Starting Capital: Default is ₹1,00,000.",
        "Max Positions: Restricts max concurrent holdings.",
        "Allocation: Allocates specific % of capital per trade.",
        "Exits execution: Simulates open gap orders."
      ]
    for b in bullets:
        p = tf_left.add_paragraph()
        p.text = "• " + b
        p.font.size = Pt(14)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(4)

    # Right Column Visual Card
    shape = slide5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.0), Inches(1.5), Inches(5.5), Inches(4.5))
    shape.fill.solid()
    shape.fill.fore_color.rgb = CARD_BG
    shape.line.color.rgb = INDIGO
    shape.line.width = Pt(2)
    
    rightBox = slide5.shapes.add_textbox(Inches(7.2), Inches(1.7), Inches(5.1), Inches(4.1))
    tf_right = rightBox.text_frame
    tf_right.word_wrap = True
    
    p = tf_right.paragraphs[0]
    p.text = "📐 Dashboard Output Metrics"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = INDIGO
    p.space_after = Pt(12)
    
    metrics = [
        "Net Portfolio Return: Total return % of capital pool.",
        "Win Rate & Average Holding Period.",
        "Equity Curve Area Chart: Visualizes Cash vs Net Asset Value.",
        "Detailed Trade Log: Lists buy/sell dates, entry/exit prices, status."
    ]
    for m in metrics:
        p = tf_right.add_paragraph()
        p.text = "✔ " + m
        p.font.size = Pt(13)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(10)

    # Save presentation
    output_filename = "NSE_Predictor_Trading_Workflow.pptx"
    prs.save(output_filename)
    print(f"Presentation saved successfully as {output_filename}")

if __name__ == "__main__":
    create_presentation()
